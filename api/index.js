const nsfwjs = require('nsfwjs');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const express = require('express');
const multer = require('multer');
const app = express();
const port = 3000;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

if (!fs.existsSync('uploads/')){
  fs.mkdirSync('uploads/');
}

class NSFWDetector {
  constructor() {
    this.model = null;
    this.isLoaded = false;
  }

  async load() {
    try {
      this.model = await nsfwjs.load();
      this.isLoaded = true;
      console.log("NSFW detection model loaded successfully");
      return true;
    } catch (error) {
      console.error("Failed to load NSFW detection model:", error);
      return false;
    }
  }

  async checkImage(imagePath) {
    if (!this.isLoaded) {
      throw new Error("Model not loaded yet");
    }

    try {
      const image = await loadImage(imagePath);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      
      const predictions = await this.model.classify(canvas);
      
      const result = {
        fileName: path.basename(imagePath),
        predictions: predictions,
        nsfw: this.isNSFW(predictions)
      };
      
      return result;
    } catch (error) {
      console.error(`Error analyzing image ${imagePath}:`, error);
      throw error;
    }
  }

  async checkFolder(folderPath) {
    if (!this.isLoaded) {
      throw new Error("Model not loaded yet");
    }

    const results = [];
    const files = fs.readdirSync(folderPath);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );

    for (const file of imageFiles) {
      try {
        const imagePath = path.join(folderPath, file);
        const result = await this.checkImage(imagePath);
        results.push(result);
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
        results.push({
          fileName: file,
          error: error.message
        });
      }
    }

    return {
      totalImages: imageFiles.length,
      nsfwCount: results.filter(r => r.nsfw).length,
      results: results
    };
  }

  isNSFW(predictions) {
    const nsfwThreshold = 0.7;
    const nsfwCategories = ['Porn', 'Sexy', 'Hentai'];
    
    for (const prediction of predictions) {
      if (nsfwCategories.includes(prediction.className) && prediction.probability > nsfwThreshold) {
        return true;
      }
    }
    
    return false;
  }
}

const detector = new NSFWDetector();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '/public/index.html'));
});

app.post('/api/check-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const result = await detector.checkImage(req.file.path);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/check-folder', async (req, res) => {
  if (!req.body.folderPath) {
    return res.status(400).json({ error: 'No folder path provided' });
  }

  try {
    const result = await detector.checkFolder(req.body.folderPath);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  const modelLoaded = await detector.load();
  
  if (modelLoaded) {
    app.listen(port, () => {
      console.log(`NSFW Detector server running at http://localhost:${port}`);
    });
  } else {
    console.error("Failed to load NSFW model. Server not started.");
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = NSFWDetector;
