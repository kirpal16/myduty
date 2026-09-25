import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const root = path.resolve(__dirname, "..");
  const masterLogoPath = path.join(root, "public", "Gujarat-police.png");

  if (!fs.existsSync(masterLogoPath)) {
    throw new Error(`Master logo not found at: ${masterLogoPath}`);
  }

  const iconsDir = path.join(root, "public", "icons");
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log("Generating PWA icons and favicons from real public/Gujarat-police.png...");

  // 1. Standard PWA Icons (192x192 & 512x512) centered with transparency
  await sharp(masterLogoPath)
    .resize(192, 192, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(iconsDir, "icon-192.png"));
  console.log("✓ Generated public/icons/icon-192.png");

  await sharp(masterLogoPath)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(iconsDir, "icon-512.png"));
  console.log("✓ Generated public/icons/icon-512.png");

  // 2. Maskable PWA Icons (192x192 & 512x512 with safe area margin on dark navy background #071633)
  const renderMaskable = async (size, outFile) => {
    const innerSize = Math.round(size * 0.76);
    const innerBuffer = await sharp(masterLogoPath)
      .resize(innerSize, innerSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 7, g: 22, b: 51, alpha: 1 },
      },
    })
      .composite([
        {
          input: innerBuffer,
          gravity: "center",
        },
      ])
      .png()
      .toFile(outFile);
  };

  await renderMaskable(192, path.join(iconsDir, "icon-maskable-192.png"));
  console.log("✓ Generated public/icons/icon-maskable-192.png");

  await renderMaskable(512, path.join(iconsDir, "icon-maskable-512.png"));
  console.log("✓ Generated public/icons/icon-maskable-512.png");

  // 3. Apple Touch Icon (180x180 with subtle dark background padding for iOS homescreen)
  const appleTouchInner = await sharp(masterLogoPath)
    .resize(144, 144, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const appleTouchBuffer = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 7, g: 22, b: 51, alpha: 1 },
    },
  })
    .composite([
      {
        input: appleTouchInner,
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, "public", "apple-touch-icon.png"), appleTouchBuffer);
  fs.writeFileSync(path.join(root, "src", "app", "apple-icon.png"), appleTouchBuffer);
  console.log("✓ Generated public/apple-touch-icon.png & src/app/apple-icon.png");

  // 4. Next.js App Router icon.png (32x32 & 48x48)
  const png32 = await sharp(masterLogoPath)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const png48 = await sharp(masterLogoPath)
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, "src", "app", "icon.png"), png48);
  console.log("✓ Generated src/app/icon.png");

  // 5. Multi-resolution favicon.ico
  const createIco = (frames) => {
    const numImages = frames.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // 1 = ICO
    header.writeUInt16LE(numImages, 4); // Number of images

    let offset = 6 + 16 * numImages;
    const entries = [];

    for (const frame of frames) {
      const entry = Buffer.alloc(16);
      entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 0);
      entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 1);
      entry.writeUInt8(0, 2);
      entry.writeUInt8(0, 3);
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(frame.buffer.length, 8);
      entry.writeUInt32LE(offset, 12);
      entries.push(entry);
      offset += frame.buffer.length;
    }

    return Buffer.concat([
      header,
      ...entries,
      ...frames.map((f) => f.buffer),
    ]);
  };

  const icoBuffer = createIco([
    { size: 32, buffer: png32 },
    { size: 48, buffer: png48 },
  ]);

  fs.writeFileSync(path.join(root, "public", "favicon.ico"), icoBuffer);
  fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), icoBuffer);
  console.log("✓ Generated public/favicon.ico & src/app/favicon.ico");

  console.log("SUCCESS: All icons regenerated from real Gujarat-police.png!");
}

run().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
