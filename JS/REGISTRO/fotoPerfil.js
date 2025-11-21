document.getElementById('foto').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const label = document.getElementById('fotoPerfilLabel');
    const preview = document.getElementById('fotoPreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            label.classList.add('has-image');
        }
        reader.readAsDataURL(file);
    } else {
        preview.src = '';
        label.classList.remove('has-image');
    }
});