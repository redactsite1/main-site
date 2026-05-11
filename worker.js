export default {
    async fetch(request, env) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      };
  
      // 1. Handle the browser's "preflight" request
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }
  
      // 2. Fetch the target Hugging Face URL
      const targetUrl = "https://huggingface.co";
      const response = await fetch(targetUrl);
  
      // 3. Create a new response and inject the CORS headers
      const newResponse = new Response(response.body, response);
      Object.keys(corsHeaders).forEach(key => {
        newResponse.headers.set(key, corsHeaders[key]);
      });
  
      return newResponse;
    }
  };
  