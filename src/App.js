import React, { useState } from "react";
import {
  Upload,
  BarChart3,
  PieChart,
  TrendingUp,
  FileText,
  X,
  Brain,
  Lightbulb,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Papa from "papaparse";

export default function CSVVisualizer() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [activeView, setActiveView] = useState("upload");
  const [aiInsights, setAiInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingData, setProcessingData] = useState(false);
  const [hoverInsight, setHoverInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const COLORS = [
    "#000000",
    "#1a1a1a",
    "#333333",
    "#4d4d4d",
    "#666666",
    "#808080",
    "#999999",
    "#b3b3b3",
  ];

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile && uploadedFile.type === "text/csv") {
      setFile(uploadedFile);
      setProcessingData(true);
      setActiveView("processing");

      Papa.parse(uploadedFile, {
        complete: async (result) => {
          const cleanData = result.data.filter((row) =>
            Object.values(row).some((val) => val !== null && val !== "")
          );
          setData(cleanData);
          const cols = Object.keys(cleanData[0] || {});
          setHeaders(cols);
          const analysisResult = analyzeData(cleanData, cols);
          setAnalysis(analysisResult);

          // Add a small delay to show the processing animation
          await new Promise((resolve) => setTimeout(resolve, 1500));

          await generateAIInsights(cleanData, cols, analysisResult);
          setProcessingData(false);
          setActiveView("dashboard");
        },
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });
    }
  };

  const analyzeData = (csvData, cols) => {
    const numericColumns = {};
    const categoricalColumns = {};

    cols.forEach((header) => {
      const values = csvData
        .map((row) => row[header])
        .filter((v) => v !== null && v !== "" && v !== undefined);
      const numericValues = values.filter(
        (v) =>
          (!isNaN(v) && v !== "" && typeof v !== "string") ||
          (typeof v === "string" && !isNaN(parseFloat(v)) && isFinite(v))
      );

      if (
        numericValues.length > values.length * 0.5 &&
        numericValues.length > 0
      ) {
        const numbers = numericValues.map((v) =>
          typeof v === "number" ? v : parseFloat(v)
        );
        const sum = numbers.reduce((a, b) => a + b, 0);
        const sortedNumbers = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sortedNumbers.length / 2);
        const median =
          sortedNumbers.length % 2 === 0
            ? (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2
            : sortedNumbers[mid];

        numericColumns[header] = {
          mean: (sum / numbers.length).toFixed(2),
          median: median.toFixed(2),
          min: Math.min(...numbers).toFixed(2),
          max: Math.max(...numbers).toFixed(2),
          sum: sum.toFixed(2),
          count: numbers.length,
        };
      } else {
        const freq = {};
        values.forEach((v) => {
          const key = String(v);
          freq[key] = (freq[key] || 0) + 1;
        });
        const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        categoricalColumns[header] = {
          unique: Object.keys(freq).length,
          mostCommon: sortedFreq[0],
          distribution: freq,
          total: values.length,
        };
      }
    });

    return {
      totalRows: csvData.length,
      totalColumns: cols.length,
      numeric: numericColumns,
      categorical: categoricalColumns,
    };
  };

  const generateAIInsights = async (csvData, cols, analysisResult) => {
    setLoading(true);
    try {
      // Prepare data summary for AI
      const dataSummary = {
        columns: cols,
        rowCount: csvData.length,
        sampleRows: csvData.slice(0, 5),
        statistics: analysisResult,
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Analyze this CSV data and provide intelligent insights. Here's the data summary:

Columns: ${cols.join(", ")}
Total Rows: ${csvData.length}
Sample Data: ${JSON.stringify(csvData.slice(0, 3))}
Statistics: ${JSON.stringify(analysisResult)}

Please provide:
1. What type of data is this? (e.g., sales data, employee data, survey results, etc.)
2. Key insights and patterns you notice
3. Notable trends or anomalies
4. Recommendations for further analysis
5. What the data reveals about the subject

Format your response as JSON with these keys: dataType, keyInsights (array), trends (array), recommendations (array), summary`,
            },
          ],
        }),
      });

      const result = await response.json();
      const aiText = result.content[0].text;

      // Try to parse JSON response
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const insights = JSON.parse(jsonMatch[0]);
          setAiInsights(insights);
        } else {
          // Fallback if not JSON
          setAiInsights({
            dataType: "Unknown",
            summary: aiText,
            keyInsights: ["AI analysis completed - see summary"],
            trends: [],
            recommendations: [],
          });
        }
      } catch (e) {
        setAiInsights({
          dataType: "Unknown",
          summary: aiText,
          keyInsights: ["AI analysis completed"],
          trends: [],
          recommendations: [],
        });
      }
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiInsights({
        dataType: "Unable to determine",
        summary:
          "AI analysis is temporarily unavailable. Showing statistical analysis only.",
        keyInsights: ["Manual analysis available in statistics section"],
        trends: [],
        recommendations: [],
      });
    }
    setLoading(false);
  };

  const getChartData = (column, limit = 10) => {
    if (!data.length || !column) return [];

    const freq = {};
    let totalCount = 0;

    data.forEach((row) => {
      const val = row[column];
      if (val !== null && val !== "" && val !== undefined) {
        const key = String(val);
        freq[key] = (freq[key] || 0) + 1;
        totalCount++;
      }
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, value]) => ({
        name:
          String(name).length > 20
            ? String(name).substring(0, 20) + "..."
            : String(name),
        value: value,
        percentage: ((value / totalCount) * 100).toFixed(1),
      }));
  };

  const renderProcessingView = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
      <div className="bg-black text-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full border-4 border-black">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-full mb-8 animate-pulse">
            <Brain className="w-12 h-12 text-black" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-4">
            Processing Your Data
          </h2>

          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center space-x-3">
              <div
                className="w-3 h-3 bg-white rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="w-3 h-3 bg-white rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></div>
              <div
                className="w-3 h-3 bg-white rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></div>
            </div>

            <p className="text-gray-300 text-lg">{file?.name}</p>
          </div>

          <div className="space-y-3 text-left bg-gray-900 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white">Reading CSV file...</span>
            </div>
            <div className="flex items-center space-x-3">
              <div
                className="w-2 h-2 bg-green-400 rounded-full animate-pulse"
                style={{ animationDelay: "200ms" }}
              ></div>
              <span className="text-white">Analyzing data structure...</span>
            </div>
            <div className="flex items-center space-x-3">
              <div
                className="w-2 h-2 bg-green-400 rounded-full animate-pulse"
                style={{ animationDelay: "400ms" }}
              ></div>
              <span className="text-white">Calculating statistics...</span>
            </div>
            <div className="flex items-center space-x-3">
              <div
                className="w-2 h-2 bg-green-400 rounded-full animate-pulse"
                style={{ animationDelay: "600ms" }}
              ></div>
              <span className="text-white">Generating AI insights...</span>
            </div>
            <div className="flex items-center space-x-3">
              <div
                className="w-2 h-2 bg-green-400 rounded-full animate-pulse"
                style={{ animationDelay: "800ms" }}
              ></div>
              <span className="text-white">Creating visualizations...</span>
            </div>
          </div>

          <div className="mt-8">
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-white h-2 rounded-full animate-pulse"
                style={{
                  width: "100%",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUploadView = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
      <div className="bg-black text-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full border-4 border-black">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-6">
            <Brain className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            AI-Powered CSV Analyzer
          </h1>
          <p className="text-gray-300 text-lg">
            Upload your CSV file for intelligent analysis and insights
          </p>
        </div>

        <label className="flex flex-col items-center justify-center w-full h-64 border-3 border-dashed border-white rounded-xl cursor-pointer bg-black hover:bg-gray-900 transition-all duration-300">
          <div className="flex flex-col items-center justify-center pt-7">
            <Upload className="w-16 h-16 text-white mb-4" />
            <p className="mb-2 text-xl font-semibold text-white">
              Click to upload CSV
            </p>
            <p className="text-sm text-gray-400">
              AI will analyze and understand your data automatically
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".csv"
            onChange={handleFileUpload}
          />
        </label>

        {file && (
          <div className="mt-6 p-4 bg-white text-black border-2 border-black rounded-lg">
            <p className="font-medium flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              {file.name} uploaded successfully!
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const generateChartInsight = async (chartType, column, dataPoint) => {
    setInsightLoading(true);
    try {
      const contextData = {
        chartType,
        column,
        dataPoint,
        totalRows: data.length,
        columnStats: analysis.numeric[column] || analysis.categorical[column],
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Provide a brief insight about this data point from a ${chartType} chart:

Column: ${column}
Data Point: ${JSON.stringify(dataPoint)}
Total Records: ${data.length}
Column Statistics: ${JSON.stringify(contextData.columnStats)}

Give a 2-3 sentence insight about what this data point means, its significance, or any interesting pattern. Be specific and actionable.`,
            },
          ],
        }),
      });

      const result = await response.json();
      const insightText = result.content[0].text;
      setHoverInsight(insightText);
    } catch (error) {
      console.error("Insight generation error:", error);
      setHoverInsight("Unable to generate insight at this moment.");
    }
    setInsightLoading(false);
  };

  const handleChartHover = (chart, data) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const payload = data.activePayload[0].payload;
      generateChartInsight(
        chart.type,
        chart.column || chart.columns[0],
        payload
      );
    }
  };

  const getBestChartsForData = () => {
    const categoricalCols = Object.keys(analysis?.categorical || {});
    const numericCols = Object.keys(analysis?.numeric || {});

    const charts = [];

    // Add pie charts for categorical data with reasonable unique values (2-15)
    categoricalCols.forEach((col) => {
      const uniqueCount = analysis.categorical[col].unique;
      if (uniqueCount >= 2 && uniqueCount <= 15) {
        charts.push({
          type: "pie",
          column: col,
          title: `${col} Distribution`,
          description: `Shows the breakdown of ${analysis.categorical[col].total} records across ${uniqueCount} categories`,
        });
      }
    });

    // Add bar charts for categorical data
    categoricalCols.forEach((col) => {
      const uniqueCount = analysis.categorical[col].unique;
      if (uniqueCount >= 2 && uniqueCount <= 20) {
        charts.push({
          type: "bar",
          column: col,
          title: `${col} Frequency`,
          description: `Count of occurrences for each ${col}`,
        });
      }
    });

    // Add line charts for numeric data to show trends
    if (numericCols.length >= 2) {
      charts.push({
        type: "line",
        columns: numericCols.slice(0, 3),
        title: `Numeric Trends: ${numericCols.slice(0, 3).join(", ")}`,
        description: `Shows the progression of numeric values across records`,
      });
    }

    // Add scatter/comparison for numeric data
    if (numericCols.length >= 2) {
      charts.push({
        type: "comparison",
        columns: [numericCols[0], numericCols[1]],
        title: `${numericCols[0]} vs ${numericCols[1]}`,
        description: `Comparison of two numeric variables`,
      });
    }

    return charts.slice(0, 6); // Limit to 6 most relevant charts
  };

  const getLineChartData = (columns) => {
    return data.slice(0, 50).map((row, idx) => {
      const point = { index: idx + 1 };
      columns.forEach((col) => {
        const val = row[col];
        if (!isNaN(val) && val !== null && val !== "") {
          point[col] = typeof val === "number" ? val : parseFloat(val);
        }
      });
      return point;
    });
  };

  const getComparisonData = (col1, col2) => {
    return data
      .slice(0, 100)
      .map((row, idx) => {
        const val1 = row[col1];
        const val2 = row[col2];
        if (!isNaN(val1) && !isNaN(val2) && val1 !== null && val2 !== null) {
          return {
            [col1]: typeof val1 === "number" ? val1 : parseFloat(val1),
            [col2]: typeof val2 === "number" ? val2 : parseFloat(val2),
            index: idx + 1,
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const renderDashboard = () => {
    const categoricalCols = Object.keys(analysis?.categorical || {});
    const numericCols = Object.keys(analysis?.numeric || {});
    const charts = getBestChartsForData();

    return (
      <div className="min-h-screen bg-white">
        <div className="bg-black text-white shadow-lg border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-2xl font-bold text-white">
                  AI Data Analysis
                </h2>
                <p className="text-sm text-gray-300">{file?.name}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveView("upload");
                setFile(null);
                setData([]);
                setAnalysis(null);
                setAiInsights(null);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-semibold"
            >
              <X className="w-4 h-4" />
              <span>Clear Data</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {loading && (
            <div className="bg-black text-white rounded-xl shadow-lg p-8 mb-8 border-4 border-black text-center">
              <Brain className="w-12 h-12 text-white mx-auto mb-4 animate-pulse" />
              <p className="text-xl font-semibold">
                AI is analyzing your data...
              </p>
            </div>
          )}

          {aiInsights && !loading && (
            <div className="bg-black text-white rounded-xl shadow-lg p-8 mb-8 border-4 border-black">
              <h3 className="text-2xl font-bold mb-6 flex items-center">
                <Lightbulb className="w-6 h-6 mr-3 text-white" />
                AI Intelligence Report
              </h3>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-300 mb-2">
                    Data Type Identified:
                  </h4>
                  <p className="text-xl font-bold">{aiInsights.dataType}</p>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-300 mb-2">
                    Executive Summary:
                  </h4>
                  <p className="text-white leading-relaxed">
                    {aiInsights.summary}
                  </p>
                </div>

                {aiInsights.keyInsights &&
                  aiInsights.keyInsights.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-300 mb-3">
                        Key Insights:
                      </h4>
                      <ul className="space-y-2">
                        {aiInsights.keyInsights.map((insight, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-white mr-2">•</span>
                            <span className="text-white">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {aiInsights.trends && aiInsights.trends.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-300 mb-3">
                      Trends & Patterns:
                    </h4>
                    <ul className="space-y-2">
                      {aiInsights.trends.map((trend, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-white mr-2">→</span>
                          <span className="text-white">{trend}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiInsights.recommendations &&
                  aiInsights.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-300 mb-3">
                        Recommendations:
                      </h4>
                      <ul className="space-y-2">
                        {aiInsights.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-white mr-2">✓</span>
                            <span className="text-white">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-black text-white rounded-xl shadow-lg p-6 border-4 border-black">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm font-medium">
                    Total Rows
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {analysis?.totalRows}
                  </p>
                </div>
                <div className="bg-white rounded-full p-3">
                  <TrendingUp className="w-8 h-8 text-black" />
                </div>
              </div>
            </div>

            <div className="bg-black text-white rounded-xl shadow-lg p-6 border-4 border-black">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm font-medium">
                    Total Columns
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {analysis?.totalColumns}
                  </p>
                </div>
                <div className="bg-white rounded-full p-3">
                  <BarChart3 className="w-8 h-8 text-black" />
                </div>
              </div>
            </div>

            <div className="bg-black text-white rounded-xl shadow-lg p-6 border-4 border-black">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm font-medium">
                    Numeric Fields
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {numericCols.length}
                  </p>
                </div>
                <div className="bg-white rounded-full p-3">
                  <PieChart className="w-8 h-8 text-black" />
                </div>
              </div>
            </div>
          </div>

          {hoverInsight && (
            <div className="bg-black text-white rounded-xl shadow-lg p-6 mb-8 border-4 border-black sticky top-4 z-20">
              <div className="flex items-start space-x-3">
                <Lightbulb className="w-6 h-6 text-white flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-lg font-bold mb-2">AI Insight</h4>
                  {insightLoading ? (
                    <p className="text-gray-300 animate-pulse">
                      Analyzing data point...
                    </p>
                  ) : (
                    <p className="text-gray-200 leading-relaxed">
                      {hoverInsight}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {charts.map((chart, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-lg p-6 border-4 border-black"
              >
                <h3 className="text-xl font-bold text-black mb-2 flex items-center">
                  {chart.type === "pie" && (
                    <PieChart className="w-5 h-5 mr-2 text-black" />
                  )}
                  {chart.type === "bar" && (
                    <BarChart3 className="w-5 h-5 mr-2 text-black" />
                  )}
                  {chart.type === "line" && (
                    <TrendingUp className="w-5 h-5 mr-2 text-black" />
                  )}
                  {chart.type === "comparison" && (
                    <BarChart3 className="w-5 h-5 mr-2 text-black" />
                  )}
                  {chart.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {chart.description}w{" "}
                </p>

                <ResponsiveContainer width="100%" height={300}>
                  {chart.type === "pie" && (
                    <RePieChart
                      onMouseMove={(data) => handleChartHover(chart, data)}
                    >
                      <Pie
                        data={getChartData(chart.column, 8)}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, value, percentage }) =>
                          `${name}: ${value} (${percentage}%)`
                        }
                        outerRadius={100}
                        fill="#000000"
                        dataKey="value"
                      >
                        {getChartData(chart.column, 8).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#000",
                          color: "#fff",
                          border: "3px solid #000",
                          borderRadius: "8px",
                          padding: "12px",
                          fontSize: "14px",
                          fontWeight: "bold",
                        }}
                        formatter={(value, name, props) => {
                          const { payload } = props;
                          return [
                            <div key="tooltip">
                              <div style={{ marginBottom: "4px" }}>
                                Category: {payload.name}
                              </div>
                              <div style={{ marginBottom: "4px" }}>
                                Count: {payload.value}
                              </div>
                              <div>Percentage: {payload.percentage}%</div>
                            </div>,
                            "",
                          ];
                        }}
                      />
                    </RePieChart>
                  )}

                  {chart.type === "bar" && (
                    <BarChart
                      data={getChartData(chart.column, 10)}
                      onMouseMove={(data) => handleChartHover(chart, data)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#000" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        stroke="#000"
                      />
                      <YAxis stroke="#000" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#000",
                          color: "#fff",
                          border: "3px solid #000",
                          borderRadius: "8px",
                          padding: "12px",
                          fontSize: "14px",
                          fontWeight: "bold",
                        }}
                        formatter={(value, name, props) => {
                          const { payload } = props;
                          return [
                            <div key="tooltip">
                              <div style={{ marginBottom: "4px" }}>
                                Category: {payload.name}
                              </div>
                              <div style={{ marginBottom: "4px" }}>
                                Count: {payload.value}
                              </div>
                              <div>Percentage: {payload.percentage}%</div>
                            </div>,
                            "",
                          ];
                        }}
                      />
                      <Bar dataKey="value" fill="#000000" radius={[8, 8, 0, 0]}>
                        {getChartData(chart.column, 10).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}

                  {chart.type === "line" && (
                    <LineChart
                      data={getLineChartData(chart.columns)}
                      onMouseMove={(data) => handleChartHover(chart, data)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#000" />
                      <XAxis
                        dataKey="index"
                        stroke="#000"
                        label={{
                          value: "Record #",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis stroke="#000" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#000",
                          color: "#fff",
                          border: "3px solid #000",
                          borderRadius: "8px",
                          padding: "12px",
                          fontSize: "14px",
                          fontWeight: "bold",
                        }}
                        formatter={(value, name) => {
                          return [
                            <div key="tooltip">
                              <div style={{ marginBottom: "4px" }}>
                                {name}:{" "}
                                {typeof value === "number"
                                  ? value.toFixed(2)
                                  : value}
                              </div>
                            </div>,
                            "",
                          ];
                        }}
                        labelFormatter={(label) => `Record #${label}`}
                      />
                      <Legend />
                      {chart.columns.map((col, i) => (
                        <Line
                          key={col}
                          type="monotone"
                          dataKey={col}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={2}
                          dot={{ fill: COLORS[i % COLORS.length] }}
                        />
                      ))}
                    </LineChart>
                  )}

                  {chart.type === "comparison" && (
                    <BarChart
                      data={getComparisonData(
                        chart.columns[0],
                        chart.columns[1]
                      )}
                      onMouseMove={(data) => handleChartHover(chart, data)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#000" />
                      <XAxis
                        dataKey="index"
                        stroke="#000"
                        label={{
                          value: "Record #",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis stroke="#000" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#000",
                          color: "#fff",
                          border: "3px solid #000",
                          borderRadius: "8px",
                          padding: "12px",
                          fontSize: "14px",
                          fontWeight: "bold",
                        }}
                        formatter={(value, name) => {
                          return [
                            <div key="tooltip" style={{ marginBottom: "4px" }}>
                              {name}:{" "}
                              {typeof value === "number"
                                ? value.toFixed(2)
                                : value}
                            </div>,
                            "",
                          ];
                        }}
                        labelFormatter={(label) => `Record #${label}`}
                      />
                      <Legend />
                      <Bar dataKey={chart.columns[0]} fill={COLORS[0]} />
                      <Bar dataKey={chart.columns[1]} fill={COLORS[3]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-4 border-black">
            <h3 className="text-xl font-bold text-black mb-6 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-black" />
              Statistical Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {numericCols.map((col) => (
                <div
                  key={col}
                  className="bg-gray-100 rounded-lg p-5 border-2 border-black"
                >
                  <h4 className="font-semibold text-black mb-3 text-lg">
                    {col}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Mean:</span>
                      <span className="font-semibold text-black">
                        {analysis.numeric[col].mean}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Median:</span>
                      <span className="font-semibold text-black">
                        {analysis.numeric[col].median}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Min:</span>
                      <span className="font-semibold text-black">
                        {analysis.numeric[col].min}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Max:</span>
                      <span className="font-semibold text-black">
                        {analysis.numeric[col].max}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Sum:</span>
                      <span className="font-semibold text-black">
                        {analysis.numeric[col].sum}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Count:</span>
                      <span className="font-semibold text-black">
                        {analysis.numeric[col].count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-4 border-black">
            <h3 className="text-xl font-bold text-black mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-black" />
              Data Preview
            </h3>
            <div className="overflow-auto max-h-96 border-2 border-gray-300 rounded-lg">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-black text-white">
                    {headers.map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-sm font-semibold border-b-2 border-black whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-100 transition-colors"
                    >
                      {headers.map((header) => (
                        <td
                          key={header}
                          className="px-4 py-3 text-sm text-black border-b border-gray-300 whitespace-nowrap"
                        >
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-gray-600 text-sm">
                Showing all {data.length} rows
              </p>
              <p className="text-gray-500 text-xs">
                Scroll horizontally and vertically to view all data
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return activeView === "upload"
    ? renderUploadView()
    : activeView === "processing"
    ? renderProcessingView()
    : renderDashboard();
}
