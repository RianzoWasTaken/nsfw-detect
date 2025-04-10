const express = require('express');
const fetch = require('node-fetch');
const nsfw = require('nsfwjs');
const tf = require('@tensorflow/tfjs-node');

const app = express();
const PORT = 3000;

let model;

(async () => {
  model = await nsfw.load();
})();

async function detectImage(imageUrl) {
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();
  const imageTensor = tf.node.decodeImage(buffer, 3);
  const predictions = await model.classify(imageTensor);
  imageTensor.dispose();
  return predictions;
}

app.get('/', async (req, res) => {
  const imgUrl = req.query.img;
  if (!imgUrl) return res.status(400).json({ error: 'No image URL provided.' });

  try {
    const results = await detectImage(imgUrl);
    res.json({ nsfw_result: results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process image', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`NSFW API running on http://localhost:${PORT}`);
});
module.exports = app
