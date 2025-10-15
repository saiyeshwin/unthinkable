import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API_BASE_URL = "http://localhost:8000";

const CodeReviewDashboard = () => {
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [stats, setStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");

  useEffect(() => {
    fetchReviews();
    fetchStats();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/reviews`);
      setReviews(res.data);
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE_URL}/review/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSelectedReview(res.data);
      fetchReviews();
      fetchStats();
      setActiveTab("reviews");
      alert("✅ Code review completed successfully!");
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("❌ Error uploading file. Please try again.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const getBadgeClass = (severity) => {
    const map = {
      low: "badge badge-low",
      medium: "badge badge-medium",
      high: "badge badge-high",
      critical: "badge badge-critical",
    };
    return map[severity] || "badge badge-category";
  };

  return (
    <div>
      <header>
        <div className="container">
          <h1>Code Review Assistant</h1>
          <p>AI-powered code analysis and improvement suggestions</p>
        </div>
      </header>
      <nav>
        <div className="container">
          <div className="nav-tabs">
            {["upload", "reviews", "stats"].map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="container">
        {activeTab === "upload" && (
          <div className="card">
            <h2 className="card-title">Upload Code for Review</h2>
            <p className="upload-hint">
              Upload your code file to get an AI-powered analysis with
              suggestions for improvements.
            </p>
            <div className="upload-zone">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileUpload}
                disabled={uploading}
                accept=".py,.js,.ts,.java,.cpp,.c,.go,.rs,.rb,.php,.swift,.kt"
              />
              <label htmlFor="file-upload" className="upload-btn">
                {uploading ? "Analyzing..." : "Choose File"}
              </label>
              <p className="upload-hint">
                Supported: Python, JavaScript, TypeScript, Java, C++, C, Go,
                Rust, Ruby, PHP, Swift, Kotlin
              </p>
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div>
            {selectedReview ? (
              <>
                <a
                  href="#back"
                  className="back-link"
                  onClick={() => setSelectedReview(null)}
                >
                  ← Back to Reviews
                </a>

                <div className="card">
                  <h2 className="card-title">{selectedReview.filename}</h2>
                  <div className="review-meta mb-2">
                    <span className="badge-language">
                      {selectedReview.language}
                    </span>
                    <span>{selectedReview.lines_of_code} lines</span>
                    <span>
                      {new Date(selectedReview.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="score-grid">
                    <div className="score-box">
                      <h3>Readability</h3>
                      <div className="score-value">
                        {selectedReview.readability_score}/10
                      </div>
                    </div>
                    <div className="score-box">
                      <h3>Modularity</h3>
                      <div className="score-value">
                        {selectedReview.modularity_score}/10
                      </div>
                    </div>
                    <div className="score-box">
                      <h3>Bug Risk</h3>
                      <div className="score-value">
                        {selectedReview.bug_risk_score}/10
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="card-title">Summary</h3>
                    <p>{selectedReview.review_summary}</p>
                  </div>

                  {selectedReview.issues.length > 0 && (
                    <div>
                      <h3 className="card-title">Issues Found</h3>
                      {selectedReview.issues.map((issue, i) => (
                        <div key={i} className="issue-card">
                          <div className="issue-header">
                            <div>
                              <span className={getBadgeClass(issue.severity)}>
                                {issue.severity}
                              </span>{" "}
                              <span className="badge-category">
                                {issue.type}
                              </span>
                              {issue.line && (
                                <span className="badge-language">
                                  Line {issue.line}
                                </span>
                              )}
                            </div>
                          </div>
                          <p>{issue.description}</p>
                          {issue.code_snippet && (
                            <pre>
                              <code>{issue.code_snippet}</code>
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedReview.suggestions.length > 0 && (
                    <div>
                      <h3 className="card-title">Suggestions</h3>
                      {selectedReview.suggestions.map((s, i) => (
                        <div key={i} className="suggestion-card">
                          <div className="suggestion-header">
                            <h4 className="suggestion-title">{s.title}</h4>
                            <div>
                              <span className={getBadgeClass(s.severity)}>
                                {s.severity}
                              </span>{" "}
                              <span className="badge-category">
                                {s.category}
                              </span>
                            </div>
                          </div>
                          {s.line && (
                            <p className="review-meta">Line {s.line}</p>
                          )}
                          <p>{s.description}</p>
                          {s.code_snippet && (
                            <>
                              <p className="text-gray mb-1">Current:</p>
                              <pre>
                                <code>{s.code_snippet}</code>
                              </pre>
                            </>
                          )}
                          {s.improved_code && (
                            <>
                              <p className="text-green mb-1">Suggested:</p>
                              <pre className="code-improved">
                                <code>{s.improved_code}</code>
                              </pre>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div>
                <h2 className="card-title">Recent Reviews</h2>
                {reviews.length > 0 ? (
                  reviews.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReview(r)}
                      className="review-card"
                    >
                      <div className="review-header">
                        <div>
                          <h3 className="review-title">{r.filename}</h3>
                          <p className="review-summary">{r.review_summary}</p>
                          <div className="review-meta">
                            <span className="badge-language">{r.language}</span>
                            <span>{r.lines_of_code} lines</span>
                            <span>
                              {r.issues.length} issues, {r.suggestions.length}{" "}
                              suggestions
                            </span>
                          </div>
                        </div>
                        <div className="review-scores">
                          <div className="score-item">
                            <div className="score-value">
                              {r.readability_score}
                            </div>
                            <div className="score-label">Read</div>
                          </div>
                          <div className="score-item">
                            <div className="score-value">
                              {r.modularity_score}
                            </div>
                            <div className="score-label">Mod</div>
                          </div>
                          <div className="score-item">
                            <div className="score-value">
                              {r.bug_risk_score}
                            </div>
                            <div className="score-label">Risk</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    No reviews yet. Upload your first code file!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === "stats" && stats && (
          <div>
            <h2 className="card-title mb-2">Statistics</h2>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Reviews</div>
                <div className="stat-value">{stats.total_reviews}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg Readability</div>
                <div className="stat-value">
                  {stats.average_scores.readability}/10
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg Modularity</div>
                <div className="stat-value">
                  {stats.average_scores.modularity}/10
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg Bug Risk</div>
                <div className="stat-value">
                  {stats.average_scores.bug_risk}/10
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Language Distribution</h3>
              {Object.entries(stats.languages).map(([lang, count]) => (
                <div key={lang} className="progress-bar">
                  <div className="progress-label">{lang}</div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(count / stats.total_reviews) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <div className="progress-count">{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CodeReviewDashboard;
