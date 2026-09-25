import * as THREE from 'three';

type EarthPointData = {
  positions: Float32Array;
  sizes: Float32Array;
  seeds: Float32Array;
  count: number;
};

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Converts an equirectangular black/white land mask into a GPU-friendly
 * point cloud. White pixels represent land.
 */
export function createEarthPoints(
  image: CanvasImageSource,
  radius = 1.78,
  sampleStep = 3,
): EarthPointData {
  const width = image instanceof HTMLImageElement ? image.naturalWidth : 0;
  const height = image instanceof HTMLImageElement ? image.naturalHeight : 0;

  if (!width || !height) {
    return {
      positions: new Float32Array(),
      sizes: new Float32Array(),
      seeds: new Float32Array(),
      count: 0,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return {
      positions: new Float32Array(),
      sizes: new Float32Array(),
      seeds: new Float32Array(),
      count: 0,
    };
  }

  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;

  const positions: number[] = [];
  const sizes: number[] = [];
  const seeds: number[] = [];

  let pointIndex = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const pixelIndex = (y * width + x) * 4;
      const value = pixels[pixelIndex];

      if (value < 170) continue;

      const longitude = (x / width) * 360 - 180;
      const latitude = 90 - (y / height) * 180;

      // Keep a very small amount of deterministic depth variation so the
      // point cloud has a computational/volumetric character.
      const jitter = (seededRandom(pointIndex + 17) - 0.5) * 0.018;
      const position = new THREE.Vector3();
      const phi = (90 - latitude) * (Math.PI / 180);
      const theta = (longitude + 180) * (Math.PI / 180);
      const r = radius + jitter;

      position.set(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      );

      positions.push(position.x, position.y, position.z);
      sizes.push(0.86 + seededRandom(pointIndex + 91) * 0.72);
      seeds.push(seededRandom(pointIndex + 131));

      pointIndex += 1;
    }
  }

  return {
    positions: new Float32Array(positions),
    sizes: new Float32Array(sizes),
    seeds: new Float32Array(seeds),
    count: positions.length / 3,
  };
}
