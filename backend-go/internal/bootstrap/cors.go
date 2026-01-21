package bootstrap

import "github.com/gin-gonic/gin"

func setupCORS(r *gin.Engine) {
	if r == nil {
		return
	}
	// 全局 CORS（开发阶段允许前端本地调试）
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		// 只在本地开发时放开 localhost:3000，如需更多域名可按需扩展
		if origin == "http://localhost:14399" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		// 预检请求直接返回
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})
}

