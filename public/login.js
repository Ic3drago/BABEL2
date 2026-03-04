document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-message');
    const btn = document.getElementById('login-btn');

    errorMsg.classList.add('hidden');
    btn.innerHTML = '<span class="animate-pulse">Verificando...</span>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Información de acceso incorrecta');
        }

        // Save the JWT and Role
        localStorage.setItem('babel_token', data.token);
        localStorage.setItem('babel_role', data.role);

        // Redirect based on role
        if (data.role === 'admin') {
            window.location.href = '/admin'; // Admin goes to admin panel
        } else if (data.role === 'bartender') {
            window.location.href = '/pos'; // Bartender goes directly to POS
        } else {
            window.location.href = '/';
        }

    } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('hidden');
        btn.innerHTML = 'Ingresar al Sistema';
        btn.disabled = false;
    }
});
