document.addEventListener("DOMContentLoaded", function () {

    let hueBase = Math.floor(Math.random() * 360);

    function getColorSpinning(offset = 0) {
        hueBase = (hueBase + 67) % 360; // Tăng mỗi lần gọi, dùng số nguyên tố khác để giảm trùng lặp
        const sat = 70 + Math.random() * 25;  // Saturation: 70–95%
        const light = 60 + Math.random() * 25; // Lightness: 60–85%
        return `hsl(${(hueBase + offset) % 360}, ${sat}%, ${light}%)`;
    }

    function setAnimatedGradient() {
        const color1 = getColorSpinning(0);
        const color2 = getColorSpinning(60);
        const color3 = getColorSpinning(120);
        document.body.style.background = `linear-gradient(135deg, ${color1}, ${color2}, ${color3})`;
        document.body.style.backgroundSize = '600% 600%';
        document.body.style.animation = 'gradientMove 10s ease infinite';
    }

    // Gọi khi tải trang
    setAnimatedGradient();

    const audio = document.getElementById('audio');

    // Audio toggle state
    let isAudioPlaying = false;

    // Audio toggle handler
    document.addEventListener('click', () => {
        isAudioPlaying = !isAudioPlaying;
        isAudioPlaying ? audio.play() : audio.pause();
    });

    document.getElementById("year").textContent = new Date().getFullYear();

    function showAlert(message) {
        const defaultMsg = "This website and its source code are protected by copyright. Unauthorized access, modification, or reproduction is strictly prohibited and may violate applicable laws.";
        document.getElementById('alertMsg').textContent = message || defaultMsg;
        document.getElementById('customAlert').style.display = 'block';
    }


    // Ngăn chuột phải
    document.addEventListener('contextmenu', e => {
        e.preventDefault();
        showAlert();
    });

    // Ngăn phím truy cập mã nguồn
    document.addEventListener('keydown', e => {
        const key = e.key.toUpperCase();
        if (
            e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(key)) || // Ctrl+Shift+I/J/C
            (e.ctrlKey && ['U', 'S'].includes(key)) // Ctrl+U/S
        ) {
            e.preventDefault();
            showAlert();
        }
    });

    // Ngăn sao chép, chọn, kéo
    ['copy', 'selectstart', 'dragstart'].forEach(evt =>
        document.addEventListener(evt, e => {
            e.preventDefault();
            if (evt === 'copy') showAlert("Copying content is disabled.");
        })
    );

    var sakura = new Sakura('body', {
        colors: [
            {
                gradientColorStart: '#FFFFFF',
                gradientColorEnd: '#FFFFFF',
                gradientColorDegree: 120,
            },
            {
                gradientColorStart: '#FFFFFF',
                gradientColorEnd: '#FFFFFF',
                gradientColorDegree: 120,
            },
            {
                gradientColorStart: '#FFFFFF',
                gradientColorEnd: '#FFFFFF',
                gradientColorDegree: 120,
            },
        ],
        delay: 300,
    });
});
function closeAlert() {
    document.getElementById('customAlert').style.display = 'none';
}
