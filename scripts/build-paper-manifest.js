const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const primaryPaperDirectory = path.join(projectRoot, 'papers');
const paperDirectories = [
  primaryPaperDirectory,
  path.join(projectRoot, 'paper'),
];
const outputFile = path.join(__dirname, 'paper-manifest.js');
const readLimit = 2 * 1024 * 1024;

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function decodeEntities(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodePdfString(value = '') {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, character) => {
      const escapes = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
      };
      return escapes[character];
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal) =>
      String.fromCharCode(parseInt(octal, 8)),
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function decodePdfHex(value = '') {
  const buffer = Buffer.from(value.replace(/\s+/g, ''), 'hex');
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    let decoded = '';
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      decoded += String.fromCharCode(buffer.readUInt16BE(index));
    }
    return decoded.trim();
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    let decoded = '';
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      decoded += String.fromCharCode(buffer.readUInt16LE(index));
    }
    return decoded.trim();
  }
  return buffer.toString('utf8').trim();
}

function firstMatch(source, patterns, decoder = decodeEntities) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const value = decoder(match[1]);
      if (value) {
        return value;
      }
    }
  }
  return '';
}

function allMatches(source, pattern) {
  const values = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const value = decodeEntities(match[1]);
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function readPdfMetadata(filePath) {
  const stats = fs.statSync(filePath);
  const descriptor = fs.openSync(filePath, 'r');
  const headSize = Math.min(readLimit, stats.size);
  const tailSize = Math.min(readLimit, Math.max(0, stats.size - headSize));
  const head = Buffer.alloc(headSize);
  const tail = Buffer.alloc(tailSize);

  try {
    fs.readSync(descriptor, head, 0, headSize, 0);
    if (tailSize) {
      fs.readSync(descriptor, tail, 0, tailSize, stats.size - tailSize);
    }
  } finally {
    fs.closeSync(descriptor);
  }

  const pdfBuffer = Buffer.concat([head, tail]);
  const source = pdfBuffer.toString('latin1');
  const xmpSource = pdfBuffer.toString('utf8');
  const creatorBlock = firstMatch(
    xmpSource,
    [/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i],
    value => value,
  );
  const subjectBlock = firstMatch(
    xmpSource,
    [/<dc:subject[^>]*>([\s\S]*?)<\/dc:subject>/i],
    value => value,
  );
  const xmpTitle = firstMatch(xmpSource, [
    /<dc:title[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i,
    /<pdf:Title[^>]*>([\s\S]*?)<\/pdf:Title>/i,
  ]);
  const infoTitle =
    firstMatch(
      source,
      [/\/Title\s*\(((?:\\.|[^\\)])*)\)/i],
      decodePdfString,
    ) ||
    firstMatch(source, [/\/Title\s*<([0-9a-f\s]+)>/i], decodePdfHex);

  return {
    title: xmpTitle || infoTitle,
    authors: creatorBlock
      ? allMatches(creatorBlock, /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi)
      : [
          firstMatch(
            source,
            [/\/Author\s*\(((?:\\.|[^\\)])*)\)/i],
            decodePdfString,
          ) ||
            firstMatch(source, [/\/Author\s*<([0-9a-f\s]+)>/i], decodePdfHex),
        ].filter(Boolean),
    date:
      firstMatch(xmpSource, [
        /<prism:publicationDate[^>]*>([\s\S]*?)<\/prism:publicationDate>/i,
        /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i,
        /<xmp:CreateDate[^>]*>([\s\S]*?)<\/xmp:CreateDate>/i,
      ]) ||
      firstMatch(source, [
        /\/CreationDate\s*\(D:([^)]+)\)/i,
        /\/ModDate\s*\(D:([^)]+)\)/i,
      ]),
    doi: firstMatch(xmpSource, [
      /<prism:doi[^>]*>([\s\S]*?)<\/prism:doi>/i,
      /<dc:identifier[^>]*>(?:doi:)?([\s\S]*?)<\/dc:identifier>/i,
    ]),
    venue: firstMatch(xmpSource, [
      /<prism:publicationName[^>]*>([\s\S]*?)<\/prism:publicationName>/i,
      /<citation_journal_title[^>]*>([\s\S]*?)<\/citation_journal_title>/i,
    ]),
    abstract: firstMatch(xmpSource, [
      /<dc:description[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i,
      /<prism:abstract[^>]*>([\s\S]*?)<\/prism:abstract>/i,
    ]),
    keywords: subjectBlock
      ? allMatches(subjectBlock, /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi)
      : [],
    size: stats.size,
    modifiedYear: stats.mtime.getFullYear(),
  };
}

function readSidecar(filePath) {
  const extension = path.extname(filePath);
  const candidates = [
    filePath.slice(0, -extension.length) + '.json',
    `${filePath}.json`,
  ];
  const sidecar = candidates.find(candidate => fs.existsSync(candidate));

  if (!sidecar) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  } catch (error) {
    console.warn(
      `[papers] Bỏ qua metadata lỗi tại ${path.relative(projectRoot, sidecar)}: ${error.message}`,
    );
    return {};
  }
}

function titleFromFile(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/(?:19|20)\d{2}/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase()) || 'Untitled research paper';
}

function toList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(/[;,]/).map(item => item.trim()).filter(Boolean);
  }

  return [];
}

function findYear(...values) {
  for (const value of values) {
    const match = String(value || '').match(/(?:19|20)\d{2}/);
    if (match) {
      return Number(match[0]);
    }
  }
  return null;
}

function inferType(filePath) {
  const source = filePath.toLowerCase();
  if (/(conference|proceeding|hội nghị|hoi-nghi)/.test(source)) {
    return 'Conference Paper';
  }
  if (/(thesis|dissertation|luận văn|luan-van)/.test(source)) {
    return 'Thesis';
  }
  if (/(report|technical-report|báo cáo|bao-cao)/.test(source)) {
    return 'Technical Report';
  }
  if (/(preprint|working-paper)/.test(source)) {
    return 'Preprint';
  }
  if (/(journal|article|tạp chí|tap-chi)/.test(source)) {
    return 'Journal Article';
  }
  return 'Research Paper';
}

function publicPath(filePath) {
  return path
    .relative(projectRoot, filePath)
    .split(path.sep)
    .map(encodeURIComponent)
    .join('/');
}

function buildPaper(filePath) {
  const extracted = readPdfMetadata(filePath);
  const sidecar = readSidecar(filePath);
  const relativePath = path.relative(projectRoot, filePath);
  const year =
    findYear(sidecar.year, sidecar.date, extracted.date, relativePath) ||
    extracted.modifiedYear;
  const fileName =
    path.basename(filePath, path.extname(filePath)).trim() || 'Untitled research paper';
  const authors = ['Minh Duy Pham'];
  const keywords = toList(sidecar.keywords ?? extracted.keywords);
  const doiCandidate = String(sidecar.doi || extracted.doi || '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
  const doi = /^10\.\d{4,9}\//i.test(doiCandidate) ? doiCandidate : '';

  return {
    id: crypto.createHash('sha1').update(relativePath).digest('hex').slice(0, 10),
    src: publicPath(filePath),
    name: fileName,
    title: fileName,
    authors,
    year,
    type: String(sidecar.type || inferType(relativePath)).trim(),
    venue: String(sidecar.venue || sidecar.journal || extracted.venue || '').trim(),
    doi,
    abstract: String(sidecar.abstract || extracted.abstract || '').trim(),
    keywords,
    featured: Boolean(sidecar.featured),
    size: extracted.size,
  };
}

fs.mkdirSync(primaryPaperDirectory, { recursive: true });

const pdfFiles = paperDirectories
  .flatMap(directory => walk(directory))
  .filter(filePath => path.extname(filePath).toLowerCase() === '.pdf');

const papers = pdfFiles
  .map(filePath => {
    try {
      return buildPaper(filePath);
    } catch (error) {
      console.warn(
        `[papers] Không thể đọc ${path.relative(projectRoot, filePath)}: ${error.message}`,
      );
      return null;
    }
  })
  .filter(Boolean)
  .sort((first, second) => {
    if (first.featured !== second.featured) {
      return Number(second.featured) - Number(first.featured);
    }
    if (first.year !== second.year) {
      return second.year - first.year;
    }
    return first.title.localeCompare(second.title, 'vi');
  });

const output = `// Generated by scripts/build-paper-manifest.js\nwindow.__PORTFOLIO_PAPERS__ = ${JSON.stringify(papers, null, 2)};\n`;
fs.writeFileSync(outputFile, output, 'utf8');

console.log(`[papers] Đã lập chỉ mục ${papers.length} PDF từ paper/ và papers/.`);
