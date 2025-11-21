// Función para el menú hamburguesa
document.getElementById('hamburger-btn').addEventListener('click', function() {
    const navbarList = document.querySelector('.navbar-list');
    navbarList.classList.toggle('responsive');
});
