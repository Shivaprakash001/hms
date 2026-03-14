import toast from 'react-hot-toast';

/**
 * Parses API error responses and returns a user-friendly message.
 */
export const extractErrorMessage = (error) => {
  if (!error) return "An unexpected error occurred.";
  
  if (error.response) {
    // API returning structured errors (Our new format)
    const { data } = error.response;
    
    // Check for validation errors
    if (data?.code === "VALIDATION_ERROR" && data.details) {
      return data.details.map((err) => `${err.field}: ${err.message}`).join(', ');
    }
    
    // Generic API message
    if (data?.message) {
      return data.message;
    }
    
    // Fallback dictionary detail
    if (data?.detail) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail)) return data.detail.map((e) => e.msg).join(', ');
    }
    
    if (error.response.status === 401) return "Session expired. Please login again.";
    if (error.response.status === 403) return "You don't have permission to perform this action.";
    if (error.response.status === 404) return "Resource not found.";
    if (error.response.status >= 500) return "Server error. Please try again later.";
    
    return `Error ${error.response.status}`;
  } else if (error.request) {
    return "Network error. Please check your connection.";
  } else {
    return error.message || "An unexpected error occurred.";
  }
};

/**
 * Handles an API error by displaying a toast and optionally executing retry logic.
 */
export const handleApiError = (error, fallbackMsg = "Operation failed", retryFunc = null) => {
  const message = extractErrorMessage(error);
  
  toast.error(
    (t) => (
      <div className="flex flex-col gap-2">
        <span>{message || fallbackMsg}</span>
        {retryFunc && (
          <button 
            onClick={() => {
              toast.dismiss(t.id);
              retryFunc();
            }}
            className="text-xs self-start bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-1 rounded"
          >
            Retry
          </button>
        )}
      </div>
    ),
    { duration: 5000 }
  );
  
  console.error("API Error:", error);
};
