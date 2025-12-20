// Shadow mapping system (global scope)

class ShadowSystem {
  constructor(gl) {
    this.gl = gl;
    // dlgmlals3
    this.depthTextureSize = 4096;
    this.depthTexture = null;
    this.depthFramebuffer = null;
    
    this.initShadowMap();
  }

  initShadowMap() {
    const gl = this.gl;

    // Create depth texture
    this.depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 
      0, 
      gl.DEPTH_COMPONENT, 
      this.depthTextureSize, 
      this.depthTextureSize, 
      0,
      gl.DEPTH_COMPONENT, 
      gl.UNSIGNED_INT, 
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffer
    this.depthFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, 
      gl.DEPTH_ATTACHMENT, 
      gl.TEXTURE_2D, 
      this.depthTexture, 
      0
    );
  }

  getDepthTexture() {
    return this.depthTexture;
  }

  getDepthFramebuffer() {
    return this.depthFramebuffer;
  }

  getTextureSize() {
    return this.depthTextureSize;
  }

  // Begin shadow map rendering
  beginShadowPass() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthFramebuffer);
    gl.viewport(0, 0, this.depthTextureSize, this.depthTextureSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  // End shadow map rendering
  endShadowPass(canvasWidth, canvasHeight) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasWidth, canvasHeight);
  }

  // Create texture matrix for shadow projection
  createTextureMatrix(lightProjectionMatrix, lightWorldMatrix) {
    let textureMatrix = m4.identity();
    textureMatrix = m4.translate(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.scale(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.multiply(textureMatrix, lightProjectionMatrix);
    textureMatrix = m4.multiply(textureMatrix, m4.inverse(lightWorldMatrix));
    return textureMatrix;
  }
}