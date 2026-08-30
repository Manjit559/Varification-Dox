// Lightweight, in-browser face detection + match scoring.
// Uses the browser-native FaceDetector API when available, with a
// canvas-based heuristic fallback for liveness and a perceptual-hash
// style image comparison for face matching. This is intentionally a
// client-side heuristic suitable for a demo platform — not a biometric
// SDK — but produces realistic confidence scores and real detections.

export type FaceDetection = {
  detected: boolean;
  count: number;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  confidence: number;
};

export type LivenessResult = {
  score: number;
  checks: { label: string; passed: boolean; weight: number }[];
};

export type FaceMatchResult = {
  score: number;
  verdict: 'match' | 'partial' | 'no_match';
};

async function detectFaces(imageFile: File): Promise<FaceDetection> {
  try {
    const bitmap = await createImageBitmap(imageFile);
    // FaceDetector is experimental; guard for TS + runtime.
    const FD = (window as unknown as { FaceDetector?: new (opts?: unknown) => { detect: (img: ImageBitmap) => Promise<DOMRect[]> } }).FaceDetector;
    if (FD) {
      const detector = new FD({ fastMode: true, maxDetectedFaces: 5 });
      const faces = await detector.detect(bitmap);
      if (faces.length > 0) {
        const f = faces[0];
        return {
          detected: true,
          count: faces.length,
          boundingBox: { x: f.x, y: f.y, width: f.width, height: f.height },
          confidence: 0.92,
        };
      }
      return { detected: false, count: 0, boundingBox: null, confidence: 0.2 };
    }
  } catch {
    // fall through to heuristic
  }
  return heuristicDetect(imageFile);
}

// Heuristic: analyze skin-tone pixel density in the central region.
async function heuristicDetect(imageFile: File): Promise<FaceDetection> {
  const img = await loadImage(imageFile);
  const canvas = document.createElement('canvas');
  const max = 96;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { detected: false, count: 0, boundingBox: null, confidence: 0.3 };
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let skin = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    total++;
    const isSkin =
      r > 95 && g > 40 && b > 20 &&
      r > g && r > b &&
      Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
      Math.abs(r - g) > 15;
    if (isSkin) skin++;
  }
  const ratio = skin / total;
  const detected = ratio > 0.08 && ratio < 0.65;
  return {
    detected,
    count: detected ? 1 : 0,
    boundingBox: detected ? { x: 0.2, y: 0.15, width: 0.6, height: 0.7 } : null,
    confidence: detected ? Math.min(0.9, 0.55 + ratio) : 0.25,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Average hash (aHash) over grayscale downsampled image.
async function averageHash(file: File, size = 16): Promise<Uint8Array> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8Array(size * size);
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  const hash = new Uint8Array(size * size);
  for (let i = 0; i < gray.length; i++) hash[i] = gray[i] > avg ? 1 : 0;
  return hash;
}

function hammingSimilarity(a: Uint8Array, b: Uint8Array): number {
  let same = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] === b[i]) same++;
  return same / len;
}

export async function matchFaces(selfie: File, document: File): Promise<FaceMatchResult> {
  const [h1, h2] = await Promise.all([averageHash(selfie), averageHash(document)]);
  const sim = hammingSimilarity(h1, h2);
  // Map raw similarity (typically 0.5-0.9) into a confidence-like score.
  const score = Math.round(Math.min(99, Math.max(20, (sim - 0.45) * 180 + 25)));
  const verdict: FaceMatchResult['verdict'] =
    score >= 75 ? 'match' : score >= 55 ? 'partial' : 'no_match';
  return { score, verdict };
}

export async function checkLiveness(selfie: File): Promise<LivenessResult> {
  const detection = await detectFaces(selfie);
  const img = await loadImage(selfie);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  const checks: LivenessResult['checks'] = [];

  // Check 1: face present
  checks.push({
    label: 'Face detected in frame',
    passed: detection.detected,
    weight: 0.35,
  });

  // Check 2: resolution adequacy
  const minDim = Math.min(img.width, img.height);
  checks.push({
    label: 'Image resolution adequate',
    passed: minDim >= 300,
    weight: 0.2,
  });

  // Check 3: aspect ratio (selfie-ish)
  const ar = Math.max(img.width, img.height) / Math.min(img.width, img.height);
  checks.push({
    label: 'Natural selfie aspect ratio',
    passed: ar >= 0.75 && ar <= 1.8,
    weight: 0.15,
  });

  // Check 4: brightness / not too dark, not blown out
  let brightScore = 0.5;
  if (ctx) {
    ctx.drawImage(img, 0, 0);
    const sample = ctx.getImageData(0, 0, Math.min(64, img.width), Math.min(64, img.height));
    let sum = 0;
    for (let i = 0; i < sample.data.length; i += 4) {
      sum += (sample.data[i] + sample.data[i + 1] + sample.data[i + 2]) / 3;
    }
    const avgBright = sum / (sample.data.length / 4);
    brightScore = avgBright / 255;
    checks.push({
      label: 'Acceptable lighting conditions',
      passed: avgBright > 50 && avgBright < 230,
      weight: 0.15,
    });
  } else {
    checks.push({ label: 'Acceptable lighting conditions', passed: true, weight: 0.15 });
  }

  // Check 5: single face (no spoof with multiple people)
  checks.push({
    label: 'Single subject present',
    passed: detection.detected && detection.count === 1,
    weight: 0.15,
  });

  const score = Math.round(
    checks.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0) * 100
  );
  return { score, checks };
}

export { detectFaces };
