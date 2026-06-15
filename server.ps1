# ==========================================================================
# Native PowerShell HTTP Web Server
# Hosts the Bindi Portrait Generator locally without Node.js or Python.
# ==========================================================================

$port = 8080
$rootDir = "C:\Users\vkp10\.gemini\antigravity-ide\scratch\bindi-portrait-generator"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "--------------------------------------------------------"
    Write-Host "  Bindi Portrait Generator server is running!"
    Write-Host "  URL: http://localhost:$port/"
    Write-Host "--------------------------------------------------------"
    Write-Host "  (To stop this server, terminate the background task)"
    Write-Host ""
    
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            $urlPath = $request.Url.LocalPath
            if ($urlPath -eq "/" -or $urlPath -eq "") {
                $urlPath = "/index.html"
            }
            
            # Translate URL path to local Windows path
            $cleanPath = $urlPath.Replace("/", "\")
            if ($cleanPath.StartsWith("\")) {
                $cleanPath = $cleanPath.Substring(1)
            }
            $filePath = Join-Path $rootDir $cleanPath
            
            if (Test-Path $filePath -PathType Leaf) {
                $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "application/octet-stream"
                
                switch ($extension) {
                    ".html" { $contentType = "text/html; charset=utf-8" }
                    ".css"  { $contentType = "text/css" }
                    ".js"   { $contentType = "application/javascript" }
                    ".png"  { $contentType = "image/png" }
                    ".jpg"  { $contentType = "image/jpeg" }
                    ".jpeg" { $contentType = "image/jpeg" }
                    ".svg"  { $contentType = "image/svg+xml" }
                    ".json" { $contentType = "application/json" }
                }
                
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $errorMessage = "404 - File Not Found: $urlPath"
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errorMessage)
                $response.ContentType = "text/plain"
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.Close()
        } catch {
            # Handle client disconnect errors gracefully
            if ($response) {
                $response.Close()
            }
        }
    }
} catch {
    Write-Error $_
} finally {
    if ($listener) {
        $listener.Stop()
        $listener.Close()
    }
}
