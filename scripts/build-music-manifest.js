const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const musicDirectory = path.join(root, 'assets', 'music');
const manifestPath = path.join(__dirname, 'music-manifest.js');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function synchsafe(buffer, offset) {
  return (
    (buffer[offset] << 21) |
    (buffer[offset + 1] << 14) |
    (buffer[offset + 2] << 7) |
    buffer[offset + 3]
  );
}

function decodeTextFrame(buffer) {
  if (buffer.length < 2) {
    return '';
  }

  const encoding = buffer[0];
  const value = buffer.subarray(1);
  let text;

  if (encoding === 0) {
    text = value.toString('latin1');
  } else if (encoding === 3) {
    text = value.toString('utf8');
  } else {
    const hasBigEndianBom = value[0] === 0xfe && value[1] === 0xff;
    const data = Buffer.from(value.subarray(2));

    if (hasBigEndianBom) {
      for (let index = 0; index + 1 < data.length; index += 2) {
        const first = data[index];
        data[index] = data[index + 1];
        data[index + 1] = first;
      }
    }

    text = data.toString('utf16le');
  }

  return text.replace(/\0/g, '').trim();
}

function readId3(filePath) {
  const descriptor = fs.openSync(filePath, 'r');

  try {
    const header = Buffer.alloc(10);
    if (fs.readSync(descriptor, header, 0, 10, 0) !== 10 || header.toString('ascii', 0, 3) !== 'ID3') {
      return {};
    }

    const version = header[3];
    const tagSize = Math.min(synchsafe(header, 6), 1024 * 1024);
    const tag = Buffer.alloc(tagSize);
    fs.readSync(descriptor, tag, 0, tagSize, 10);

    const metadata = {};
    const frameMap = {
      TIT2: 'title',
      TPE1: 'artist',
      TALB: 'album',
    };
    let offset = 0;

    while (offset + 10 <= tag.length) {
      const frameId = tag.toString('ascii', offset, offset + 4);
      if (!/^[A-Z0-9]{4}$/.test(frameId)) {
        break;
      }

      const frameSize =
        version === 4 ? synchsafe(tag, offset + 4) : tag.readUInt32BE(offset + 4);
      if (frameSize <= 0 || offset + 10 + frameSize > tag.length) {
        break;
      }

      if (frameMap[frameId]) {
        metadata[frameMap[frameId]] = decodeTextFrame(
          tag.subarray(offset + 10, offset + 10 + frameSize),
        );
      }

      offset += 10 + frameSize;
    }

    return metadata;
  } finally {
    fs.closeSync(descriptor);
  }
}

function toUrl(filePath) {
  const relative = path.relative(root, filePath).split(path.sep);
  return relative.map(segment => encodeURIComponent(segment)).join('/');
}

fs.mkdirSync(musicDirectory, { recursive: true });

const files = walk(musicDirectory)
  .filter(filePath => path.extname(filePath).toLowerCase() === '.mp3')
  .sort((first, second) => first.localeCompare(second, 'vi'));

const tracks = files.map((filePath, index) => {
  const metadata = readId3(filePath);
  return {
    src: toUrl(filePath),
    title: metadata.title || `Track ${String(index + 1).padStart(2, '0')}`,
    artist: metadata.artist || 'Local MP3',
    album: metadata.album || 'Portfolio playlist',
  };
});

const output = `window.__PORTFOLIO_TRACKS__ = ${JSON.stringify(tracks, null, 2)};\n`;
fs.writeFileSync(manifestPath, output, 'utf8');

console.log(`Music manifest: ${tracks.length} MP3 file(s).`);
