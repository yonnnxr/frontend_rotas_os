document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const mapContainer = document.getElementById('map-container');
    let map = null;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const teamCode = document.getElementById('team-code').value;

        try {
            const response = await fetch('/validate-team', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ team_code: teamCode })
            });

            if (response.ok) {
                loginContainer.classList.add('hidden');
                mapContainer.classList.remove('hidden');
                initializeMap();
            } else {
                alert('Código de equipe inválido!');
            }
        } catch (error) {
            console.error('Erro ao validar equipe:', error);
            alert('Erro ao validar equipe. Tente novamente.');
        }
    });

    function initializeMap() {
        if (!map) {
            map = L.map('map').setView([-23.550520, -46.633308], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
        }
    }
}); 