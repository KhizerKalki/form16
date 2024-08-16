/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import axios from "axios";

const FileUploadModal = ({ onClose, onUploadFailure }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState({
    assessmentYear: "",
    employerName: "",
    deductorTAN: "",
    employeeName: "",
    employeePAN: "",
  });

  const handleFailure = () => {
    document.getElementById("popup").innerHTML = "<h2>Upload Failed!</h2>";
    setTimeout(() => {
      onUploadFailure();
      onClose();
    }, 3000);
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setError("");
  };

  const uploadFile = async () => {
    setLoading(true);
    setError("");
    const formData = new FormData();
    const fieldName =
      selectedFile.type === "application/pdf" ? "pdfFile" : "image";
    const endpoint =
      selectedFile.type === "application/pdf" ? "upload" : "askAboutImages";

    formData.append(fieldName, selectedFile);

    try {
      const response = await axios.post(
        `http://localhost:5000/${endpoint}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setOutput(response.data);
      console.log(response.data);
      setError("");
    } catch (error) {
      console.error("Error:", error);
      setError(
        error.response?.data?.error ||
          "The document is not a form 16.Please try again."
      );
      handleFailure();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a file.");
      return;
    }
    uploadFile();
  };
  useEffect(() => {
    return () => {};
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "400px",
        zIndex: 1000,
        boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
      }}
    >
      {loading ? (
        <div>
          <div className="loader"></div>
          <p>Loading...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <h2>UPLOAD</h2>
          <hr />
          <div>
            <input type="file" onChange={handleFileChange} />
            <button
              className="btn"
              onClick={handleSubmit}
              style={{ marginTop: "10px" }}
            >
              Upload
            </button>
          </div>
        </form>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {output.assessmentYear && (
        <div>
          <h3>Response Data:</h3>
          <p>Assessment Year: {output.assessmentYear}</p>
          <p>Employer Name: {output.employerName}</p>
          <p>Deductor TAN: {output.deductorTAN}</p>
          <p>Employee Name: {output.employeeName}</p>
          <p>Employee PAN: {output.employeePAN}</p>
        </div>
      )}
    </div>
  );
};

export default FileUploadModal;
