// frontend API helper
const API_URL = "http://localhost:5000/api";

function getToken() {
    return localStorage.getItem("token");
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        API_URL + endpoint,
        {
            ...options,
            headers
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Request failed"
        );
    }

    return data;
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    location.href = "login.html";
}
