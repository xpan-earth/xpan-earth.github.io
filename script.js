document.addEventListener("DOMContentLoaded", function() {
    document.querySelector("form").addEventListener("submit", function(event) {
        event.preventDefault();

        var formData = new FormData(this);
        
        fetch("https://script.google.com/macros/s/AKfycbxVBYDPBPqY9OO2om-CseZdYgThhWoHowZUpgAp1iKj8tlg1BSZNNxcwKDJYHdTOh_S/exec", {
            method: "POST",
            body: formData
        })
        .then(response => response.text())
        .then(data => {
            document.querySelector("p").innerText = "gracias por tu registro.";
            document.querySelector("form").reset();
        })
        .catch(error => {
            document.querySelector("p").innerText = "el envío falló. por favor inténtelo nuevamente.";
        });
    });
});