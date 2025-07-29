// Questionnaire page functionality
class QuestionnaireManager {
  constructor() {
    this.sessionId = null;
    this.userId = null;
    this.questions = [];
    this.answers = [];
    this.currentQuestionIndex = 0;

    this.initElements();
    this.init();
  }

  initElements() {
    this.loadingEl = document.getElementById("loading");
    this.errorEl = document.getElementById("error");
    this.errorMessageEl = document.getElementById("error-message");
    this.questionnaireEl = document.getElementById("questionnaire");
    this.currentUserEl = document.getElementById("current-user");
    this.otherUserEl = document.getElementById("other-user");
    this.progressFillEl = document.getElementById("progress-fill");
    this.progressTextEl = document.getElementById("progress-text");
    this.questionsContainerEl = document.getElementById("questions-container");
    this.submitSectionEl = document.getElementById("submit-section");
    this.submittingEl = document.getElementById("submitting");
    this.completionEl = document.getElementById("completion");
    this.completionContentEl = document.getElementById("completion-content");
    this.submitBtn = document.getElementById("submit-btn");
    this.reviewBtn = document.getElementById("review-btn");
  }

  async init() {
    try {
      this.parseUrlParams();
      await this.loadQuestions();
      this.setupEventListeners();
      this.renderQuestions();
      this.hideLoading();
    } catch (error) {
      this.showError(error.message);
    }
  }

  parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    this.sessionId = urlParams.get("session_id");
    this.userId = urlParams.get("user");

    if (!this.sessionId || !this.userId) {
      throw new Error(
        "Invalid session link. Please check the URL and try again."
      );
    }
  }

  async loadQuestions() {
    const backendUrl = "http://151.115.75.195:8000";
    const response = await fetch(
      `${backendUrl}/questions/${this.sessionId}/${encodeURIComponent(
        this.userId
      )}`
    );
    const data = await response.json();

    if (!response.ok) {
      // Handle maintenance mode
      if (response.status === 503 && data.maintenance) {
        throw new Error("The service is under maintenance, try later");
      }
      throw new Error(data.error || "Failed to load questions");
    }

    this.questions = data.questions;
    this.sessionData = {
      sessionId: data.session_id,
      users: data.users,
    };

    // Initialize answers array
    this.answers = this.questions.map((q) => ({
      question_id: q.id,
      question: q.text,
      answer: null,
    }));

    // Set user names
    this.currentUserEl.textContent = this.userId;
    const otherUser =
      this.userId === data.users.user1 ? data.users.user2 : data.users.user1;
    this.otherUserEl.textContent = otherUser;
  }

  setupEventListeners() {
    this.submitBtn.addEventListener("click", this.handleSubmit.bind(this));
    this.reviewBtn.addEventListener("click", this.scrollToTop.bind(this));

    // Event delegation for answer buttons
    this.questionsContainerEl.addEventListener("click", (event) => {
      if (event.target.classList.contains("answer-btn")) {
        const questionId = parseInt(
          event.target.getAttribute("data-question-id")
        );
        const answer = event.target.getAttribute("data-answer") === "true";
        this.selectAnswer(questionId, answer);
      }
    });
  }

  renderQuestions() {
    this.questionsContainerEl.innerHTML = "";

    this.questions.forEach((question, index) => {
      const questionEl = this.createQuestionElement(question, index);
      this.questionsContainerEl.appendChild(questionEl);
    });

    this.updateProgress();
  }

  createQuestionElement(question, index) {
    const questionDiv = document.createElement("div");
    questionDiv.className = "question-item";
    questionDiv.setAttribute("data-testid", "question-item");
    questionDiv.innerHTML = `
      <div class="question-text" data-testid="question-text">${this.escapeHtml(
        question.text
      )}</div>
      <div class="question-answers">
        <button 
          class="btn btn-secondary answer-btn" 
          data-question-id="${question.id}" 
          data-answer="true"
          data-testid="answer-yes"
        >
          Yes
        </button>
        <button 
          class="btn btn-secondary answer-btn" 
          data-question-id="${question.id}" 
          data-answer="false"
          data-testid="answer-no"
        >
          No
        </button>
      </div>
    `;

    return questionDiv;
  }

  selectAnswer(questionId, answer) {
    // Update answer in data
    const answerIndex = this.answers.findIndex(
      (a) => a.question_id === questionId
    );
    if (answerIndex !== -1) {
      this.answers[answerIndex].answer = answer;
    }

    // Update UI
    const buttons = document.querySelectorAll(
      `[data-question-id="${questionId}"]`
    );
    buttons.forEach((btn) => {
      btn.classList.remove("selected-yes", "selected-no");
      const btnAnswer = btn.getAttribute("data-answer") === "true";
      if (btnAnswer === answer) {
        btn.classList.add(answer ? "selected-yes" : "selected-no");
      }
    });

    this.updateProgress();
  }

  updateProgress() {
    const answeredCount = this.answers.filter((a) => a.answer !== null).length;
    const totalCount = this.answers.length;
    const percentage = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

    this.progressFillEl.style.width = `${percentage}%`;
    this.progressTextEl.textContent = `${answeredCount} of ${totalCount} answered`;

    // Show submit section if all questions answered
    if (answeredCount === totalCount) {
      this.submitSectionEl.classList.remove("hidden");
      this.submitBtn.disabled = false;
      this.submitBtn.classList.remove("btn-disabled");
      this.submitBtn.classList.add("btn-primary");
    } else {
      this.submitSectionEl.classList.add("hidden");
      this.submitBtn.disabled = true;
      this.submitBtn.classList.add("btn-disabled");
      this.submitBtn.classList.remove("btn-primary");
    }
  }

  async handleSubmit() {
    // Validate all questions are answered
    const unansweredCount = this.answers.filter(
      (a) => a.answer === null
    ).length;
    if (unansweredCount > 0) {
      alert(
        `Please answer all questions. ${unansweredCount} questions remaining.`
      );
      return;
    }

    this.submittingEl.classList.remove("hidden");
    this.submitBtn.disabled = true;

    try {
      const backendUrl = "http://151.115.75.195:8000";
      const response = await fetch(
        `${backendUrl}/sessions/${this.sessionId}/answers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: this.userId,
            answers: this.answers,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle maintenance mode
        if (response.status === 503 && data.maintenance) {
          throw new Error("The service is under maintenance, try later");
        }
        throw new Error(data.error || "Failed to submit answers");
      }

      this.showCompletion(data);
    } catch (error) {
      this.showError(error.message);
      this.submitBtn.disabled = false;
    } finally {
      this.submittingEl.classList.add("hidden");
    }
  }

  showCompletion(data) {
    this.questionnaireEl.classList.add("hidden");
    this.completionEl.classList.remove("hidden");

    // Check if both users have completed - if so, redirect to results
    if (data.can_view_results) {
      const resultsLink = `${window.location.origin}/results.html?session_id=${this.sessionId}`;

      // Show a brief message before redirecting
      this.completionContentEl.innerHTML = `
        <p class="success-message">Your answers have been submitted!</p>
        <p class="redirect-message">Both users have completed! Redirecting to results...</p>
        <div class="loading-spinner">⏳</div>
      `;

      // Redirect after a short delay to show the message
      setTimeout(() => {
        window.location.href = resultsLink;
      }, 2000);

      return;
    }

    // Original completion flow for when other user hasn't completed yet
    const sessionData = JSON.parse(
      sessionStorage.getItem("sessionData") || "{}"
    );
    const baseUrl = window.location.origin;

    // Generate links
    const otherUser =
      this.userId === this.sessionData.users.user1
        ? this.sessionData.users.user2
        : this.sessionData.users.user1;

    const shareLink =
      sessionData.user2Link ||
      `${baseUrl}/questionnaire.html?session_id=${
        this.sessionId
      }&user=${encodeURIComponent(otherUser)}`;
    const resultsLink = `${baseUrl}/results.html?session_id=${this.sessionId}`;

    let content = `
      <p class="success-message">Your answers have been submitted!</p>
      
      <div class="session-info">
        <div class="info-group">
          <h3>Share This Link</h3>
          <div class="link-container">
            <input type="text" id="share-link" class="link-input" value="${shareLink}" readonly>
          </div>
          <p class="help-text">Send this link to ${otherUser} to complete the questionnaire</p>
        </div>

        <div class="info-group">
          <h3>Check Results</h3>
          <div class="link-container">
            <input type="text" id="results-link" class="link-input" value="${resultsLink}" readonly>
          </div>
          <p class="help-text">Use this link to check results after ${otherUser} completes their part</p>
        </div>
      </div>

      <div class="actions">
        <a href="${resultsLink}" class="btn btn-primary">Check Results Now</a>
        <a href="/" class="btn btn-secondary">Create New Session</a>
      </div>
    `;

    this.completionContentEl.innerHTML = content;
  }

  showError(message) {
    this.errorMessageEl.textContent = message;
    this.hideLoading();
    this.errorEl.classList.remove("hidden");
  }

  hideLoading() {
    this.loadingEl.classList.add("hidden");
    this.questionnaireEl.classList.remove("hidden");
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global functions
async function checkResults() {
  try {
    const sessionId = window.location.pathname.split("/")[2];
    const backendUrl = "http://151.115.75.195:8000";
    const response = await fetch(`${backendUrl}/sessions/${sessionId}`);
    const data = await response.json();

    if (
      response.ok &&
      data.completed[data.users.user1] &&
      data.completed[data.users.user2]
    ) {
      window.location.href = `/results.html?session_id=${sessionId}`;
    } else {
      alert(
        "The other person has not completed the questionnaire yet. Please wait and try again."
      );
    }
  } catch (error) {
    alert("Failed to check results. Please try again.");
  }
}

// Initialize when DOM is loaded
let questionnaireManager;
document.addEventListener("DOMContentLoaded", () => {
  questionnaireManager = new QuestionnaireManager();
});

// Make functions globally available
window.checkResults = checkResults;
