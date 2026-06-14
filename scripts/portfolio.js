(() => {
  document.documentElement.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function readPreference(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function savePreference(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage is optional.
    }
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return '0:00';
    }

    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  class AssetPlaylist extends EventTarget {
    constructor(tracks) {
      super();
      this.tracks = this.shuffle([...tracks]);
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.audio.volume = readPreference('pmd-music-volume', 0.32);
      this.audio.muted = readPreference('pmd-music-muted', false);
      this.index = -1;
      this.resumeAfterVisibility = false;

      this.audio.addEventListener('play', () => this.emit('statechange'));
      this.audio.addEventListener('pause', () => this.emit('statechange'));
      this.audio.addEventListener('volumechange', () => this.emit('volumechange'));
      this.audio.addEventListener('timeupdate', () => this.emit('progress'));
      this.audio.addEventListener('durationchange', () => this.emit('progress'));
      this.audio.addEventListener('ended', () => this.next(true));
      this.audio.addEventListener('error', () => {
        this.emit('error', { message: 'Không thể đọc file MP3 này.' });
      });

      if (this.available) {
        this.load(0);
      }
    }

    get available() {
      return this.tracks.length > 0;
    }

    get playing() {
      return !this.audio.paused && !this.audio.ended;
    }

    get muted() {
      return this.audio.muted;
    }

    get volume() {
      return this.audio.volume;
    }

    get currentTrack() {
      return this.tracks[this.index] || null;
    }

    shuffle(items) {
      for (let index = items.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
      }
      return items;
    }

    emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail }));
    }

    load(index) {
      if (!this.available) {
        return;
      }

      this.index = (index + this.tracks.length) % this.tracks.length;
      this.audio.src = this.currentTrack.src;
      this.audio.load();
      this.emit('trackchange', { track: this.currentTrack });
    }

    async play() {
      if (!this.available) {
        throw new Error('No MP3 files are available.');
      }

      await this.audio.play();
    }

    pause() {
      this.audio.pause();
    }

    async next(autoplay = this.playing) {
      if (!this.available) {
        return;
      }

      if (this.tracks.length > 1) {
        const offset = 1 + Math.floor(Math.random() * (this.tracks.length - 1));
        this.load(this.index + offset);
      } else {
        this.audio.currentTime = 0;
      }

      if (autoplay) {
        try {
          await this.play();
        } catch {
          this.emit('error', { message: 'Trình duyệt đã chặn phát nhạc tự động.' });
        }
      }
    }

    setVolume(value) {
      this.audio.volume = Math.min(1, Math.max(0, Number(value)));
      savePreference('pmd-music-volume', this.audio.volume);
    }

    setMuted(muted) {
      this.audio.muted = muted;
      savePreference('pmd-music-muted', muted);
    }
  }

  class MotionField {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      this.points = [];
      this.pointer = { x: -1000, y: -1000 };
      this.scroll = 0;
      this.frame = null;
      this.lastTime = 0;
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);

      this.resize();
      window.addEventListener('resize', this.resize, { passive: true });
      window.addEventListener(
        'scroll',
        () => {
          this.scroll = window.scrollY;
        },
        { passive: true },
      );

      if (finePointer.matches) {
        window.addEventListener(
          'pointermove',
          event => {
            this.pointer.x = event.clientX;
            this.pointer.y = event.clientY;
          },
          { passive: true },
        );
      }

      if (reduceMotion.matches) {
        this.draw(0);
      } else {
        this.frame = window.requestAnimationFrame(this.draw);
      }
    }

    resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = Math.max(16, Math.min(38, Math.round(this.width / 38)));
      this.points = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        baseX: Math.random() * this.width,
        baseY: Math.random() * this.height,
        radius: index % 6 === 0 ? 1.6 : 0.8,
        speed: 0.00005 + Math.random() * 0.00007,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    draw(timestamp) {
      const delta = Math.min(32, timestamp - this.lastTime || 16);
      this.lastTime = timestamp;
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);

      const gridOffset = (this.scroll * 0.08) % 72;
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(134, 173, 189, 0.022)';
      context.beginPath();
      for (let x = -gridOffset; x < this.width; x += 72) {
        context.moveTo(x, 0);
        context.lineTo(x, this.height);
      }
      for (let y = -gridOffset; y < this.height; y += 72) {
        context.moveTo(0, y);
        context.lineTo(this.width, y);
      }
      context.stroke();

      this.points.forEach(point => {
        point.phase += delta * point.speed;
        point.x = point.baseX + Math.cos(point.phase) * 10;
        point.y = point.baseY + Math.sin(point.phase * 0.8) * 8;

        const pointerDistance = Math.hypot(
          point.x - this.pointer.x,
          point.y - this.pointer.y,
        );
        if (pointerDistance < 150) {
          const strength = (150 - pointerDistance) / 150;
          point.x += (point.x - this.pointer.x) * strength * 0.035;
          point.y += (point.y - this.pointer.y) * strength * 0.035;
        }
      });

      for (let first = 0; first < this.points.length; first += 1) {
        const point = this.points[first];
        for (let second = first + 1; second < this.points.length; second += 1) {
          const other = this.points[second];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance > 110) {
            continue;
          }

          context.strokeStyle = `rgba(134, 173, 189, ${(1 - distance / 110) * 0.07})`;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }

        context.strokeStyle =
          point.radius > 1
            ? 'rgba(184, 160, 107, 0.48)'
            : 'rgba(166, 192, 202, 0.24)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(point.x - point.radius * 2.4, point.y);
        context.lineTo(point.x + point.radius * 2.4, point.y);
        context.moveTo(point.x, point.y - point.radius * 2.4);
        context.lineTo(point.x, point.y + point.radius * 2.4);
        context.stroke();
      }

      if (!reduceMotion.matches) {
        this.frame = window.requestAnimationFrame(this.draw);
      }
    }
  }

  class SakuraField {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      this.petals = [];
      this.frame = null;
      this.lastTime = 0;
      this.time = 0;
      this.running = true;
      this.blockers = [];
      this.layoutFrame = null;
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      this.queueBlockerRefresh = this.queueBlockerRefresh.bind(this);

      this.resize();
      window.addEventListener('resize', this.resize, { passive: true });
      window.addEventListener('scroll', this.queueBlockerRefresh, { passive: true });
      document.addEventListener('visibilitychange', () => {
        this.running = !document.hidden;
        if (this.running && !this.frame) {
          this.lastTime = performance.now();
          this.frame = window.requestAnimationFrame(this.draw);
        }
      });
      this.frame = window.requestAnimationFrame(this.draw);
    }

    queueBlockerRefresh() {
      if (this.layoutFrame) {
        return;
      }
      this.layoutFrame = window.requestAnimationFrame(() => {
        this.refreshBlockers();
        this.layoutFrame = null;
      });
    }

    refreshBlockers() {
      const selector = [
        '.site-header',
        '.hero-copy',
        '.portrait-frame',
        '.portrait-note',
        '.hero-specs',
        '.section-intro',
        '.section-heading',
        '.about-copy > p',
        '.career-record',
        '.method-flow',
        '.focus-card',
        '.profile-band',
        '.publication-toolbar',
        '.publication-card',
        '.publication-empty',
        '.gallery-card',
        '.contact',
        '.site-footer',
        '.music-player',
        '.sound-hint',
      ].join(',');

      this.blockers = [...document.querySelectorAll(selector)]
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.bottom >= 0 && rect.top <= this.height)
        .map(rect => ({
          left: Math.max(0, rect.left),
          top: Math.max(0, rect.top),
          width: Math.min(this.width, rect.right) - Math.max(0, rect.left),
          height: Math.min(this.height, rect.bottom) - Math.max(0, rect.top),
        }));
    }

    occludeContent() {
      this.blockers.forEach(rect => {
        if (rect.width > 0 && rect.height > 0) {
          this.context.clearRect(rect.left, rect.top, rect.width, rect.height);
        }
      });
    }

    createPetal(initial = false) {
      const scale = 0.58 + Math.random() * 0.82;
      return {
        x: Math.random() * this.width,
        y: initial ? Math.random() * this.height : -30 - Math.random() * 160,
        size: (5.5 + Math.random() * 5.5) * scale,
        speed: 18 + Math.random() * 30,
        drift: 13 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 1.45,
        depth: 0.52 + Math.random() * 0.48,
        color: Math.floor(Math.random() * 3),
      };
    }

    resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const targetCount = Math.max(
        10,
        Math.min(this.width < 650 ? 14 : 26, Math.round(this.width / 58)),
      );
      if (this.petals.length > targetCount) {
        this.petals.length = targetCount;
      }
      while (this.petals.length < targetCount) {
        this.petals.push(this.createPetal(true));
      }
      this.refreshBlockers();
    }

    drawPetal(petal) {
      const context = this.context;
      const palette = [
        ['rgba(240, 224, 229, 0.68)', 'rgba(191, 155, 169, 0.42)'],
        ['rgba(226, 235, 239, 0.62)', 'rgba(142, 177, 190, 0.38)'],
        ['rgba(236, 218, 225, 0.58)', 'rgba(184, 160, 107, 0.3)'],
      ];
      const [fill, edge] = palette[petal.color];
      const flatten = 0.28 + Math.abs(Math.sin(petal.spin)) * 0.72;

      context.save();
      context.translate(petal.x, petal.y);
      context.rotate(petal.spin);
      context.scale(1, flatten);
      context.globalAlpha = petal.depth;
      context.beginPath();
      context.moveTo(0, -petal.size);
      context.bezierCurveTo(
        petal.size * 0.92,
        -petal.size * 0.58,
        petal.size * 0.78,
        petal.size * 0.7,
        0,
        petal.size,
      );
      context.bezierCurveTo(
        -petal.size * 0.78,
        petal.size * 0.7,
        -petal.size * 0.92,
        -petal.size * 0.58,
        0,
        -petal.size,
      );
      context.fillStyle = fill;
      context.fill();
      context.strokeStyle = edge;
      context.lineWidth = 0.65;
      context.stroke();
      context.beginPath();
      context.moveTo(0, -petal.size * 0.65);
      context.lineTo(0, petal.size * 0.68);
      context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      context.stroke();
      context.restore();
    }

    draw(timestamp) {
      this.frame = null;
      if (!this.running) {
        return;
      }

      const delta = Math.min(40, timestamp - this.lastTime || 16) / 1000;
      this.lastTime = timestamp;
      this.time += delta;
      this.context.clearRect(0, 0, this.width, this.height);

      this.petals.forEach((petal, index) => {
        petal.phase += delta * (0.65 + petal.depth * 0.55);
        petal.spin += delta * petal.spinSpeed;
        petal.y += petal.speed * petal.depth * delta;
        petal.x +=
          (Math.sin(petal.phase) * petal.drift +
            7 +
            Math.sin(this.time * 0.24) * 5) *
          delta;

        if (petal.y > this.height + 40 || petal.x > this.width + 70) {
          this.petals[index] = this.createPetal();
        } else {
          this.drawPetal(petal);
        }
      });

      this.occludeContent();
      this.frame = window.requestAnimationFrame(this.draw);
    }
  }

  const tracks = Array.isArray(window.__PORTFOLIO_TRACKS__)
    ? window.__PORTFOLIO_TRACKS__
    : [];
  const playlist = new AssetPlaylist(tracks);
  const player = document.querySelector('.music-player');
  const title = document.querySelector('.music-title');
  const kicker = document.querySelector('.music-kicker');
  const status = document.querySelector('.music-status');
  const progress = document.querySelector('.track-progress span');
  const volume = document.querySelector('.volume-control input');
  const muteButton = document.querySelector('.music-mute');
  const nextButton = document.querySelector('.music-next');
  const soundHint = document.querySelector('.sound-hint');
  const soundHintClose = document.querySelector('.sound-hint-close');
  const audioToggles = document.querySelectorAll('[data-audio-toggle]');

  function updateTrack(track) {
    if (!track) {
      title.textContent = 'Chưa có file MP3';
      kicker.textContent = 'Local playlist';
      status.textContent = 'Thêm nhạc vào assets/music';
      return;
    }

    title.textContent = track.title;
    kicker.textContent = track.artist;
    status.textContent = playlist.playing ? 'Đang phát' : 'Sẵn sàng phát';

    if ('mediaSession' in navigator && typeof window.MediaMetadata === 'function') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
      });
    }
  }

  function updateAudioInterface(message) {
    const playing = playlist.playing;
    document.body.classList.toggle('is-audio-playing', playing);
    player?.classList.toggle('is-playing', playing);
    muteButton?.setAttribute('aria-pressed', String(playlist.muted));
    muteButton?.setAttribute(
      'aria-label',
      playlist.muted ? 'Bật âm thanh' : 'Tắt âm thanh',
    );

    audioToggles.forEach(button => {
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? 'Tạm dừng nhạc nền' : 'Bật nhạc nền');
    });

    document.querySelectorAll('.header-sound-label').forEach(label => {
      label.textContent = playlist.available
        ? playing
          ? 'Sound on'
          : 'Sound off'
        : 'No music';
    });

    if (status && message) {
      status.textContent = message;
    } else if (status && playlist.currentTrack) {
      status.textContent = playing ? 'Đang phát' : 'Đã tạm dừng';
    }
  }

  async function toggleAudio() {
    if (!playlist.available) {
      updateAudioInterface('Chạy npm run music:index sau khi thêm MP3');
      return;
    }

    if (playlist.playing) {
      playlist.pause();
      savePreference('pmd-music-enabled', false);
      return;
    }

    try {
      await playlist.play();
      savePreference('pmd-music-enabled', true);
      soundHint?.classList.remove('is-visible');
    } catch {
      updateAudioInterface('Trình duyệt đã chặn phát nhạc.');
    }
  }

  if (volume) {
    volume.value = playlist.volume;
  }

  player?.classList.toggle('has-tracks', playlist.available);

  if (!playlist.available) {
    audioToggles.forEach(button => {
      button.setAttribute('aria-disabled', 'true');
      button.disabled = true;
    });
    nextButton?.setAttribute('disabled', '');
    muteButton?.setAttribute('disabled', '');
    if (volume) {
      volume.disabled = true;
    }
  }

  audioToggles.forEach(button => button.addEventListener('click', toggleAudio));
  nextButton?.addEventListener('click', () => playlist.next(playlist.playing));
  muteButton?.addEventListener('click', () => playlist.setMuted(!playlist.muted));
  volume?.addEventListener('input', event => {
    playlist.setVolume(event.currentTarget.value);
    if (playlist.muted && Number(event.currentTarget.value) > 0) {
      playlist.setMuted(false);
    }
  });

  playlist.addEventListener('trackchange', event => updateTrack(event.detail.track));
  playlist.addEventListener('statechange', () => updateAudioInterface());
  playlist.addEventListener('volumechange', () => updateAudioInterface());
  playlist.addEventListener('error', event => updateAudioInterface(event.detail.message));
  playlist.addEventListener('progress', () => {
    const ratio =
      playlist.audio.duration > 0
        ? playlist.audio.currentTime / playlist.audio.duration
        : 0;
    progress?.style.setProperty('transform', `scaleX(${ratio})`);
    if (playlist.playing && status) {
      status.textContent = `${formatTime(playlist.audio.currentTime)} / ${formatTime(
        playlist.audio.duration,
      )}`;
    }
  });

  soundHintClose?.addEventListener('click', () => {
    soundHint?.classList.remove('is-visible');
    savePreference('pmd-sound-hint-dismissed', true);
  });

  window.setTimeout(() => {
    player?.classList.add('is-ready');
    const dismissed = readPreference('pmd-sound-hint-dismissed', false);
    if (
      playlist.available &&
      !dismissed &&
      !readPreference('pmd-music-enabled', false)
    ) {
      soundHint?.classList.add('is-visible');
      window.setTimeout(() => soundHint?.classList.remove('is-visible'), 9000);
    }
  }, 750);

  if (playlist.available && readPreference('pmd-music-enabled', false)) {
    document.addEventListener(
      'pointerdown',
      event => {
        if (!event.target.closest('[data-audio-toggle]')) {
          playlist.play().catch(() => {});
        }
      },
      { once: true, capture: true },
    );
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playlist.playing) {
      playlist.resumeAfterVisibility = true;
      playlist.pause();
    } else if (!document.hidden && playlist.resumeAfterVisibility) {
      playlist.resumeAfterVisibility = false;
      playlist.play().catch(() => {});
    }
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => playlist.play());
      navigator.mediaSession.setActionHandler('pause', () => playlist.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () =>
        playlist.next(playlist.playing),
      );
    } catch {
      // Some browsers expose Media Session but not every action.
    }
  }

  updateTrack(playlist.currentTrack);
  updateAudioInterface();

  const canvas = document.querySelector('.motion-canvas');
  if (canvas) {
    new MotionField(canvas);
  }

  const sakuraCanvas = document.querySelector('.sakura-canvas');
  let sakuraField = null;
  if (sakuraCanvas && !reduceMotion.matches) {
    sakuraField = new SakuraField(sakuraCanvas);
  }

  const year = document.querySelector('#current-year');
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const papers = Array.isArray(window.__PORTFOLIO_PAPERS__)
    ? window.__PORTFOLIO_PAPERS__
    : [];

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined && text !== null) {
      element.textContent = text;
    }
    return element;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return 'PDF';
    }

    const megabytes = bytes / (1024 * 1024);
    return megabytes >= 1
      ? `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function renderPublications() {
    const list = document.querySelector('[data-publication-list]');
    const toolbar = document.querySelector('[data-publication-toolbar]');
    const filters = document.querySelector('[data-paper-filters]');
    const count = document.querySelector('[data-paper-count]');

    if (!list || papers.length === 0) {
      return;
    }

    list.replaceChildren();
    toolbar.hidden = false;

    papers.forEach((paper, index) => {
      const card = createElement('article', 'publication-card');
      card.dataset.paperType = paper.type || 'Research Paper';
      card.dataset.reveal = '';
      card.style.setProperty('--paper-order', index);

      const marker = createElement('div', 'publication-index');
      marker.append(
        createElement('span', '', 'PUB'),
        createElement('strong', '', String(index + 1).padStart(2, '0')),
      );

      const body = createElement('div', 'publication-body');
      const meta = createElement('div', 'publication-meta');
      meta.append(
        createElement('span', '', paper.type || 'Research Paper'),
        createElement('span', '', String(paper.year || 'N.D.')),
      );
      if (paper.featured) {
        meta.append(createElement('span', 'publication-featured', 'Selected work'));
      }

      const paperTitle = createElement('h3');
      const titleLink = createElement('a', '', paper.title || 'Untitled research paper');
      titleLink.href = paper.src;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      paperTitle.append(titleLink);

      body.append(meta, paperTitle);

      if (Array.isArray(paper.authors) && paper.authors.length) {
        body.append(createElement('p', 'publication-authors', paper.authors.join(' · ')));
      }
      if (paper.venue) {
        body.append(createElement('p', 'publication-venue', paper.venue));
      }
      if (paper.abstract) {
        body.append(createElement('p', 'publication-abstract', paper.abstract));
      }
      if (Array.isArray(paper.keywords) && paper.keywords.length) {
        const keywords = createElement('div', 'publication-keywords');
        paper.keywords.slice(0, 6).forEach(keyword => {
          keywords.append(createElement('span', '', keyword));
        });
        body.append(keywords);
      }

      const actions = createElement('div', 'publication-actions');
      const pdfLink = createElement('a', 'publication-link publication-link-primary', 'Đọc PDF');
      pdfLink.href = paper.src;
      pdfLink.target = '_blank';
      pdfLink.rel = 'noopener noreferrer';
      actions.append(pdfLink);

      if (paper.doi) {
        const doiLink = createElement('a', 'publication-link', 'Mở DOI');
        doiLink.href = encodeURI(`https://doi.org/${paper.doi}`);
        doiLink.target = '_blank';
        doiLink.rel = 'noopener noreferrer';
        actions.append(doiLink);
      }
      body.append(actions);

      const data = createElement('div', 'publication-data');
      data.append(
        createElement('span', '', 'DOCUMENT / PDF'),
        createElement('strong', '', formatBytes(paper.size)),
        createElement('small', '', paper.doi ? `DOI / ${paper.doi}` : 'LOCAL ARCHIVE'),
      );

      card.append(marker, body, data);
      list.append(card);
    });

    const types = [...new Set(papers.map(paper => paper.type || 'Research Paper'))];
    const filterValues = ['Tất cả', ...types];

    function applyFilter(value) {
      let visible = 0;
      list.querySelectorAll('.publication-card').forEach(card => {
        const matches = value === 'Tất cả' || card.dataset.paperType === value;
        card.hidden = !matches;
        if (matches) {
          visible += 1;
        }
      });
      if (count) {
        count.textContent = String(visible);
      }
      filters.querySelectorAll('button').forEach(button => {
        const active = button.dataset.filter === value;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    filterValues.forEach((value, index) => {
      const button = createElement('button', 'publication-filter', value);
      button.type = 'button';
      button.dataset.filter = value;
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => applyFilter(value));
      filters.append(button);
    });

    applyFilter('Tất cả');
  }

  renderPublications();
  sakuraField?.queueBlockerRefresh();

  function alignHashTarget() {
    if (!window.location.hash) {
      return;
    }

    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ block: 'start' });
  }

  window.addEventListener('load', () => {
    window.requestAnimationFrame(alignHashTarget);
    window.setTimeout(alignHashTarget, 350);
  });

  const revealItems = document.querySelectorAll('[data-reveal]');
  revealItems.forEach(item => {
    item.style.setProperty('--reveal-delay', `${item.dataset.revealDelay || 0}ms`);
  });

  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    revealItems.forEach(item => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8%', threshold: 0.12 },
    );
    revealItems.forEach(item => revealObserver.observe(item));
  }

  window.requestAnimationFrame(() => {
    revealItems.forEach(item => {
      const bounds = item.getBoundingClientRect();
      if (bounds.top < window.innerHeight * 0.96 && bounds.bottom > 0) {
        item.classList.add('is-visible');
      }
    });
  });

  const header = document.querySelector('.site-header');
  const scrollProgress = document.querySelector('.scroll-progress span');
  const heroVisual = document.querySelector('.hero-visual');
  let scrollFrame = null;

  function updateScrollEffects() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    scrollProgress?.style.setProperty('transform', `scaleX(${ratio})`);
    header?.classList.toggle('is-compact', window.scrollY > 50);

    if (heroVisual && !reduceMotion.matches) {
      const offset = Math.min(window.scrollY, window.innerHeight) * 0.055;
      heroVisual.style.setProperty('--hero-parallax', `${-offset}px`);
    }
    scrollFrame = null;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!scrollFrame) {
        scrollFrame = window.requestAnimationFrame(updateScrollEffects);
      }
    },
    { passive: true },
  );
  updateScrollEffects();

  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav a[href^="#"]');
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            navLinks.forEach(link => {
              link.classList.toggle('is-active', link.hash === `#${entry.target.id}`);
            });
          }
        });
      },
      { rootMargin: '-30% 0px -55%', threshold: 0 },
    );
    sections.forEach(section => navObserver.observe(section));
  }

  if (finePointer.matches && !reduceMotion.matches) {
    let pointerFrame = null;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 3;

    window.addEventListener(
      'pointermove',
      event => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!pointerFrame) {
          pointerFrame = window.requestAnimationFrame(() => {
            document.documentElement.style.setProperty('--pointer-x', `${pointerX}px`);
            document.documentElement.style.setProperty('--pointer-y', `${pointerY}px`);
            pointerFrame = null;
          });
        }
      },
      { passive: true },
    );

    document.querySelectorAll('[data-tilt]').forEach(element => {
      element.addEventListener('pointermove', event => {
        const bounds = element.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        const rotateY = (x - 0.5) * 5;
        const rotateX = (0.5 - y) * 5;
        element.style.setProperty('--spot-x', `${x * 100}%`);
        element.style.setProperty('--spot-y', `${y * 100}%`);
        element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });
      element.addEventListener('pointerleave', () => {
        element.style.transform = '';
      });
    });
  }

})();
