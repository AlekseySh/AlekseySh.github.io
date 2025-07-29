// Main page functionality
class SessionManager {
  constructor() {
    this.form = document.getElementById("session-form");
    this.loadingEl = document.getElementById("loading");
    this.errorEl = document.getElementById("error");
    this.errorMessageEl = document.getElementById("error-message");
    this.sessionCreatedEl = document.getElementById("session-created");
    this.user1LinkEl = document.getElementById("user1-link");
    this.user2LinkEl = document.getElementById("user2-link");
    this.startQuestionnaireEl = document.getElementById("start-questionnaire");

    this.init();
  }

  init() {
    this.form.addEventListener("submit", this.handleSubmit.bind(this));
    document
      .getElementById("go-to-questions-btn")
      .addEventListener("click", this.handleGoToQuestions.bind(this));
  }

  async handleGoToQuestions(e) {
    e.preventDefault();

    const formData = new FormData(this.form);
    const user1 = formData.get("user1").trim();
    const user2 = formData.get("user2").trim();

    if (!this.validateInput(user1, user2)) {
      return;
    }

    this.showLoading();

    try {
      const backendUrl = "http://151.115.75.195:8000";
      const response = await fetch(`${backendUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user1, user2 }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle maintenance mode
        if (response.status === 503 && data.maintenance) {
          throw new Error("The service is under maintenance, try later");
        }
        throw new Error(data.error || "Failed to create session");
      }

      // Store session data in sessionStorage for later use
      sessionStorage.setItem(
        "sessionData",
        JSON.stringify({
          sessionId: data.session_id,
          user1Link: data.user1_link,
          user2Link: data.user2_link,
          user1: user1,
          user2: user2,
        })
      );

      // Redirect directly to questionnaire page
      window.location.href = data.user1_link;
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(this.form);
    const user1 = formData.get("user1").trim();
    const user2 = formData.get("user2").trim();

    if (!this.validateInput(user1, user2)) {
      return;
    }

    this.showLoading();

    try {
      const backendUrl = "http://151.115.75.195:8000";
      const response = await fetch(`${backendUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user1, user2 }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle maintenance mode
        if (response.status === 503 && data.maintenance) {
          throw new Error("The service is under maintenance, try later");
        }
        throw new Error(data.error || "Failed to create session");
      }

      // Store session data in sessionStorage for later use
      sessionStorage.setItem(
        "sessionData",
        JSON.stringify({
          sessionId: data.session_id,
          user1Link: data.user1_link,
          user2Link: data.user2_link,
          user1: user1,
          user2: user2,
        })
      );

      // Redirect directly to questionnaire page for e2e testing compatibility
      window.location.href = data.user1_link;
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  validateInput(user1, user2) {
    if (!user1 || !user2) {
      this.showError("Please enter both names");
      return false;
    }

    if (user1.length > 50 || user2.length > 50) {
      this.showError("Names must be 50 characters or less");
      return false;
    }

    if (user1.toLowerCase() === user2.toLowerCase()) {
      this.showError("Names must be different");
      return false;
    }

    if (!/^[a-zA-Z0-9\s]+$/.test(user1) || !/^[a-zA-Z0-9\s]+$/.test(user2)) {
      this.showError("Names can only contain letters, numbers, and spaces");
      return false;
    }

    return true;
  }

  showLoading() {
    this.loadingEl.classList.remove("hidden");
    this.hideError();
    document.getElementById("go-to-questions-btn").disabled = true;
  }

  hideLoading() {
    this.loadingEl.classList.add("hidden");
    document.getElementById("go-to-questions-btn").disabled = false;
  }

  showError(message) {
    this.errorMessageEl.textContent = message;
    this.errorEl.classList.remove("hidden");
  }

  hideError() {
    this.errorEl.classList.add("hidden");
  }

  showSessionCreated(data, user1) {
    this.user1LinkEl.value = data.user1Link;
    this.user2LinkEl.value = data.user2Link;
    this.startQuestionnaireEl.href = data.user1Link;

    this.form.parentElement.classList.add("hidden");
    this.sessionCreatedEl.classList.remove("hidden");
  }
}

// Utility functions

function startOver() {
  document.getElementById("session-created").classList.add("hidden");
  document.querySelector(".card").classList.remove("hidden");
  document.getElementById("session-form").reset();
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SessionManager();
});

// Global functions for HTML onclick handlers
window.startOver = startOver;
