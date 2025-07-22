// Results page functionality
class ResultsManager {
  constructor() {
    this.sessionId = null;
    this.results = null;

    this.initElements();
    this.init();
  }

  initElements() {
    this.loadingEl = document.getElementById("loading");
    this.errorEl = document.getElementById("error");
    this.errorMessageEl = document.getElementById("error-message");
    this.resultsEl = document.getElementById("results");
    this.user1El = document.getElementById("user1");
    this.user2El = document.getElementById("user2");
    this.matchCountEl = document.getElementById("match-count");
    this.resultsContainerEl = document.getElementById("results-container");
    this.noMatchesEl = document.getElementById("no-matches");
  }

  async init() {
    try {
      this.parseUrlParams();
      const resultsLoaded = await this.loadResults();

      // Only proceed with rendering if results were actually loaded
      if (resultsLoaded) {
        this.setupEventListeners();
        this.renderResults();
        this.hideLoading();
      }
      // If results not loaded (waiting state), showWaitingMessage already called
    } catch (error) {
      this.showError(error.message);
    }
  }

  parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    this.sessionId = urlParams.get("session_id");

    if (!this.sessionId) {
      throw new Error(
        "Invalid results link. Please check the URL and try again."
      );
    }
  }

  async loadResults() {
    const backendUrl = "http://localhost:8000";
    const response = await fetch(
      `${backendUrl}/sessions/${this.sessionId}/results`
    );
    const data = await response.json();

    if (!response.ok) {
      // Handle maintenance mode
      if (response.status === 503 && data.maintenance) {
        throw new Error("The service is under maintenance, try later");
      }
      // Check if it's a "waiting for other user" case
      if (
        response.status === 400 &&
        data.error.includes("Both users must complete")
      ) {
        this.showWaitingMessage();
        return false; // Return false to indicate results not ready
      }
      throw new Error(data.error || "Failed to load results");
    }

    this.results = data;
    return true; // Return true to indicate results loaded successfully
  }

  setupEventListeners() {
    // No event listeners needed for results page
  }

  renderResults() {
    // Set user names
    this.user1El.textContent = this.results.users.user1;
    this.user2El.textContent = this.results.users.user2;

    // Set match count
    this.matchCountEl.textContent = this.results.match_count;

    if (this.results.matches && this.results.matches.length > 0) {
      this.renderMatches();
      this.noMatchesEl.classList.add("hidden");
    } else {
      this.showNoMatches();
      this.resultsContainerEl.classList.add("hidden");
    }
  }

  renderMatches() {
    this.resultsContainerEl.innerHTML = "";

    this.results.matches.forEach((match, index) => {
      const matchEl = this.createMatchElement(match, index);
      this.resultsContainerEl.appendChild(matchEl);
    });
  }

  createMatchElement(match, index) {
    const matchDiv = document.createElement("div");
    matchDiv.className = "result-item";
    matchDiv.innerHTML = `
      <div class="result-question">${this.escapeHtml(match.question)}</div>
    `;

    // Add animation delay for staggered appearance
    matchDiv.style.animationDelay = `${index * 0.1}s`;
    matchDiv.classList.add("fade-in");

    return matchDiv;
  }

  showNoMatches() {
    this.noMatchesEl.classList.remove("hidden");

    // Update the summary section to show a more encouraging message
    const summaryEl = document.getElementById("summary");
    summaryEl.innerHTML = `
      <div class="match-count no-match">
        <span class="no-match-icon">🤝</span>
        <span class="no-match-text">Keep exploring together!</span>
      </div>
    `;
  }

  showWaitingMessage() {
    this.hideLoading();
    this.resultsEl.innerHTML = `
      <div class="card">
        <div class="waiting-message">
          <h2>⏳ Waiting for the other person</h2>
          <p>The other person needs to complete their questions before you can see the results.</p>
          <p>Come back here after they've finished, or refresh your browser to check for updates.</p>
          
          <div class="actions">
            <a href="/" class="btn btn-primary">Create New Session</a>
          </div>
        </div>
      </div>
    `;
  }

  showError(message) {
    this.errorMessageEl.textContent = message;
    this.hideLoading();
    this.errorEl.classList.remove("hidden");
  }

  hideLoading() {
    this.loadingEl.classList.add("hidden");
    this.resultsEl.classList.remove("hidden");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is loaded
let resultsManager;
document.addEventListener("DOMContentLoaded", () => {
  resultsManager = new ResultsManager();
});
