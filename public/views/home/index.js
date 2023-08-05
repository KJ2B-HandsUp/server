[...document.querySelectorAll('.FancyButton')].map(btn => {
    btn.addEventListener('mousemove', ({ offsetX, offsetY }) => {
        let x = 1 - (btn.clientWidth - offsetX) / btn.clientWidth;
        let y = 1 - (btn.clientHeight - offsetY) / btn.clientHeight;
        btn.style.setProperty('--perX', (x * 100).toFixed(2) + '%');
        btn.style.setProperty('--perY', (y * 100).toFixed(2) + '%');
    });
});