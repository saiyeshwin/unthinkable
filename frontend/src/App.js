import React, { useState, useEffect } from "react";
import axios from "axios";

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
      const response = await axios.get(`${API_BASE_URL}/reviews`);
      setReviews(response.data);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/review/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setSelectedReview(response.data);
      fetchReviews();
      fetchStats();
      setActiveTab("reviews");
      alert("✅ Code review completed successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("❌ Error uploading file. Please try again.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: "bg-blue-100 text-blue-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800",
    };
    return colors[severity] || "bg-gray-100 text-gray-800";
  };

  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Code Review Assistant
          </h1>
          <p className="text-gray-600 mt-1">
            AI-powered code analysis and improvement suggestions
          </p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {["upload", "reviews", "stats"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold mb-4">Upload Code for Review</h2>
            <p className="text-gray-600 mb-6">
              Upload your code file to get an AI-powered analysis with
              suggestions for improvements.
            </p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                accept=".py,.js,.ts,.java,.cpp,.c,.go,.rs,.rb,.php,.swift,.kt"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Analyzing..." : "Choose File"}
              </label>
              <p className="mt-4 text-sm text-gray-500">
                Supported: Python, JavaScript, TypeScript, Java, C++, C, Go,
                Rust, Ruby, PHP, Swift, Kotlin
              </p>
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            {selectedReview ? (
              <div>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="mb-4 text-blue-600 hover:text-blue-800"
                >
                  ← Back to Reviews
                </button>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="border-b pb-4 mb-6">
                    <h2 className="text-2xl font-bold">
                      {selectedReview.filename}
                    </h2>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span className="bg-gray-100 px-3 py-1 rounded">
                        {selectedReview.language}
                      </span>
                      <span>{selectedReview.lines_of_code} lines</span>
                      <span>
                        {new Date(
                          selectedReview.created_at
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-600">
                        Readability
                      </h3>
                      <p
                        className={`text-3xl font-bold ${getScoreColor(
                          selectedReview.readability_score
                        )}`}
                      >
                        {selectedReview.readability_score}/10
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-600">
                        Modularity
                      </h3>
                      <p
                        className={`text-3xl font-bold ${getScoreColor(
                          selectedReview.modularity_score
                        )}`}
                      >
                        {selectedReview.modularity_score}/10
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-600">
                        Bug Risk
                      </h3>
                      <p
                        className={`text-3xl font-bold ${getScoreColor(
                          11 - selectedReview.bug_risk_score
                        )}`}
                      >
                        {selectedReview.bug_risk_score}/10
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">Summary</h3>
                    <p className="text-gray-700 bg-blue-50 p-4 rounded">
                      {selectedReview.review_summary}
                    </p>
                  </div>

                  {/* Issues */}
                  {selectedReview.issues.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3">
                        Issues Found
                      </h3>
                      <div className="space-y-3">
                        {selectedReview.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className="border border-red-200 rounded-lg p-4 bg-red-50"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(
                                      issue.severity
                                    )}`}
                                  >
                                    {issue.severity}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {issue.type}
                                  </span>
                                  {issue.line && (
                                    <span className="text-xs text-gray-600">
                                      Line {issue.line}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-800 mb-2">
                                  {issue.description}
                                </p>
                                {issue.code_snippet && (
                                  <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
                                    <code>{issue.code_snippet}</code>
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {selectedReview.suggestions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Suggestions
                      </h3>
                      <div className="space-y-3">
                        {selectedReview.suggestions.map((s, idx) => (
                          <div
                            key={idx}
                            className="border rounded-lg p-4 bg-white"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-gray-900">
                                {s.title}
                              </h4>
                              <div className="flex space-x-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(
                                    s.severity
                                  )}`}
                                >
                                  {s.severity}
                                </span>
                                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  {s.category}
                                </span>
                              </div>
                            </div>
                            {s.line && (
                              <p className="text-xs text-gray-600 mb-2">
                                Line {s.line}
                              </p>
                            )}
                            <p className="text-gray-700 mb-3">
                              {s.description}
                            </p>
                            {s.code_snippet && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-600">
                                  Current:
                                </p>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
                                  <code>{s.code_snippet}</code>
                                </pre>
                              </div>
                            )}
                            {s.improved_code && (
                              <div className="space-y-2 mt-2">
                                <p className="text-sm font-medium text-gray-600">
                                  Suggested:
                                </p>
                                <pre className="bg-green-900 text-green-100 p-3 rounded text-sm overflow-x-auto">
                                  <code>{s.improved_code}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-4">Recent Reviews</h2>
                <div className="grid gap-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      onClick={() => setSelectedReview(review)}
                      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold mb-2">
                            {review.filename}
                          </h3>
                          <p className="text-gray-600 mb-3">
                            {review.review_summary}
                          </p>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="bg-gray-100 px-3 py-1 rounded">
                              {review.language}
                            </span>
                            <span className="text-gray-600">
                              {review.lines_of_code} lines
                            </span>
                            <span className="text-gray-600">
                              {review.issues.length} issues,{" "}
                              {review.suggestions.length} suggestions
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <div className="text-center">
                            <div
                              className={`text-2xl font-bold ${getScoreColor(
                                review.readability_score
                              )}`}
                            >
                              {review.readability_score}
                            </div>
                            <div className="text-xs text-gray-500">Read</div>
                          </div>
                          <div className="text-center">
                            <div
                              className={`text-2xl font-bold ${getScoreColor(
                                review.modularity_score
                              )}`}
                            >
                              {review.modularity_score}
                            </div>
                            <div className="text-xs text-gray-500">Mod</div>
                          </div>
                          <div className="text-center">
                            <div
                              className={`text-2xl font-bold ${getScoreColor(
                                11 - review.bug_risk_score
                              )}`}
                            >
                              {review.bug_risk_score}
                            </div>
                            <div className="text-xs text-gray-500">Risk</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {reviews.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      No reviews yet. Upload your first code file!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && stats && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Total Reviews
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  {stats.total_reviews}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Avg Readability
                </h3>
                <p
                  className={`text-3xl font-bold ${getScoreColor(
                    stats.average_scores.readability
                  )}`}
                >
                  {stats.average_scores.readability}/10
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Avg Modularity
                </h3>
                <p
                  className={`text-3xl font-bold ${getScoreColor(
                    stats.average_scores.modularity
                  )}`}
                >
                  {stats.average_scores.modularity}/10
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Avg Bug Risk
                </h3>
                <p
                  className={`text-3xl font-bold ${getScoreColor(
                    11 - stats.average_scores.bug_risk
                  )}`}
                >
                  {stats.average_scores.bug_risk}/10
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">
                Language Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.languages).map(([lang, count]) => (
                  <div key={lang} className="flex items-center">
                    <span className="w-32 text-sm font-medium text-gray-700">
                      {lang}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-blue-600 h-4 rounded-full"
                        style={{
                          width: `${(count / stats.total_reviews) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="ml-4 text-sm font-medium text-gray-600">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CodeReviewDashboard;
