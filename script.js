function menu() {
    var x = document.getElementById("links");
    if (x.style.display === "block") {
      x.style.display = "none";
    } else {
      x.style.display = "block";
    }
}

window.onload = function() {
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
        let myIndex = 0;

        function slideshow() {
            const slides = section.getElementsByClassName("slide");
            for (let i = 0; i < slides.length; i++) {
                slides[i].style.display = "none";
            }
            myIndex++;
            if (myIndex > slides.length) { myIndex = 1 }
            slides[myIndex - 1].style.display = "block";
            setTimeout(slideshow, 1000);
        }

        slideshow();
    });
};