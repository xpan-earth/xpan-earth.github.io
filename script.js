function menu() {
    const nav = document.querySelector('nav');
    const contentElements = document.querySelectorAll('article, section, address');
    
    if (nav.style.display === 'none') {
        nav.style.display = 'flex';        
        contentElements.forEach(element => {
            element.style.display = 'none';
        });
    } else {
        nav.style.display = 'none';        
        contentElements.forEach(element => {
            element.style.display = 'flex';
        });
    }
}

window.onload = function() {
    const slideshows = document.querySelectorAll('.slideshow');

    slideshows.forEach(function(slideshow) {
        const slides = slideshow.querySelectorAll('.slide');
        let currentSlide = 0;

        slides.forEach((slide, index) => {
            slide.style.display = (index === 0) ? 'block' : 'none';
        });

        function showNextSlide() {
            slides[currentSlide].style.display = 'none';

            currentSlide = (currentSlide + 1) % slides.length;

            slides[currentSlide].style.display = 'block';
        }

        setInterval(showNextSlide, 1000);
    });
};