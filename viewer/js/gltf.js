// GLTF/GLB loader (global scope)

class GLTFLoader {
  constructor(gl) {
    this.gl = gl;
  }

  componentTypeToArrayCtor(componentType) {
    switch (componentType) {
      case 5120: return Int8Array;
      case 5121: return Uint8Array;
      case 5122: return Int16Array;
      case 5123: return Uint16Array;
      case 5125: return Uint32Array;
      case 5126: return Float32Array;
      default: throw new Error('Unknown componentType: ' + componentType);
    }
  }

  typeToNumComponents(type) {
    switch (type) {
      case 'SCALAR': return 1;
      case 'VEC2':   return 2;
      case 'VEC3':   return 3;
      case 'VEC4':   return 4;
      case 'MAT2':   return 4;
      case 'MAT3':   return 9;
      case 'MAT4':   return 16;
      default: throw new Error('Unknown accessor type: ' + type);
    }
  }

  getAccessorArray(gltf, buffers, accessorIndex) {
    const acc = gltf.accessors[accessorIndex];
    const bv  = gltf.bufferViews[acc.bufferView];

    const bufferIndex = bv.buffer || 0;
    const rawBuffer = buffers[bufferIndex];
    if (!rawBuffer) {
      throw new Error('Missing buffer data. (외부 .bin을 참조하는 .gltf는 현재 구조에서 자동 로드 불가. GLB 추천)');
    }

    const Ctor = this.componentTypeToArrayCtor(acc.componentType);
    const numComp = this.typeToNumComponents(acc.type);
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);

    if (bv.byteStride && bv.byteStride !== numComp * Ctor.BYTES_PER_ELEMENT) {
      throw new Error('Interleaved bufferView(byteStride) not supported in this simple loader.');
    }

    return new Ctor(rawBuffer, byteOffset, acc.count * numComp);
  }

  async loadFile(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target.result;
          let gltfData = null;
          let buffers = [];

          const magic = new Uint32Array(arrayBuffer, 0, 1)[0];

          if (magic === 0x46546C67) {
            // GLB format
            const view = new DataView(arrayBuffer);
            const length = view.getUint32(8, true);
            let offset = 12;

            while (offset < length) {
              const chunkLength = view.getUint32(offset, true);
              const chunkType = view.getUint32(offset + 4, true);

              if (chunkType === 0x4E4F534A) { // JSON
                const jsonData = new Uint8Array(arrayBuffer, offset + 8, chunkLength);
                const jsonString = new TextDecoder().decode(jsonData);
                gltfData = JSON.parse(jsonString);
              } else if (chunkType === 0x004E4942) { // BIN
                const binChunk = arrayBuffer.slice(offset + 8, offset + 8 + chunkLength);
                buffers.push(binChunk);
              }
              offset += 8 + chunkLength;
            }
          } else {
            // GLTF JSON only (외부 리소스 로드 없음)
            const jsonString = new TextDecoder().decode(arrayBuffer);
            gltfData = JSON.parse(jsonString);
            buffers = [];
          }

          resolve({ gltf: gltfData, buffers });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  createGLTextureFromImage(img) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  async loadImageFromBufferView(gltf, buffers, imageIndex) {
    const img = gltf.images[imageIndex];
    if (!img || img.bufferView === undefined) return null;

    const bv = gltf.bufferViews[img.bufferView];
    const buf = buffers[bv.buffer || 0];
    if (!buf) return null;

    const byteOffset = bv.byteOffset || 0;
    const byteLength = bv.byteLength;
    const bytes = new Uint8Array(buf, byteOffset, byteLength);
    const mimeType = img.mimeType || "image/png";
    const blob = new Blob([bytes], { type: mimeType });

    if ('createImageBitmap' in window) {
      return await createImageBitmap(blob);
    } else {
      return await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const im = new Image();
        im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
        im.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        im.src = url;
      });
    }
  }

  async buildTextures(gltf, buffers) {
    const gltfTextures = [];
    if (!gltf.textures || !gltf.images) return gltfTextures;

    const imageTexCache = new Map();

    for (let ti = 0; ti < gltf.textures.length; ti++) {
      const t = gltf.textures[ti];
      const srcIndex = t.source;
      if (srcIndex === undefined) { 
        gltfTextures[ti] = null; 
        continue; 
      }

      if (!imageTexCache.has(srcIndex)) {
        const imgObj = await this.loadImageFromBufferView(gltf, buffers, srcIndex);
        imageTexCache.set(srcIndex, imgObj ? this.createGLTextureFromImage(imgObj) : null);
      }
      gltfTextures[ti] = imageTexCache.get(srcIndex);
    }
    return gltfTextures;
  }

  async parse(gltfData, buffers) {
    const gl = this.gl;
    const prims = [];

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    if (!gltfData.meshes || !gltfData.accessors || !gltfData.bufferViews) {
      throw new Error('Invalid glTF: missing meshes/accessors/bufferViews');
    }

    const gltfTextures = await this.buildTextures(gltfData, buffers);

    const getBaseColorTexForPrimitive = (primitive) => {
      const matIndex = primitive.material;
      if (matIndex === undefined || !gltfData.materials) return null;

      const mat = gltfData.materials[matIndex];
      const pbr = mat && mat.pbrMetallicRoughness;
      if (!pbr || !pbr.baseColorTexture) return null;

      const texIndex = pbr.baseColorTexture.index;
      return gltfTextures[texIndex] || null;
    };

    gltfData.meshes.forEach((mesh) => {
      mesh.primitives.forEach((primitive) => {
        if (!primitive.attributes || primitive.attributes.POSITION === undefined) return;

        const positionData = this.getAccessorArray(gltfData, buffers, primitive.attributes.POSITION);

        // Calculate bounding box
        for (let i = 0; i < positionData.length; i += 3) {
          minX = Math.min(minX, positionData[i]);
          minY = Math.min(minY, positionData[i + 1]);
          minZ = Math.min(minZ, positionData[i + 2]);
          maxX = Math.max(maxX, positionData[i]);
          maxY = Math.max(maxY, positionData[i + 1]);
          maxZ = Math.max(maxZ, positionData[i + 2]);
        }

        // Get normals
        let normalData;
        if (primitive.attributes.NORMAL !== undefined) {
          normalData = this.getAccessorArray(gltfData, buffers, primitive.attributes.NORMAL);
          if (!(normalData instanceof Float32Array)) {
            normalData = new Float32Array(normalData);
          }
        } else {
          normalData = new Float32Array((positionData.length / 3) * 3);
          for (let i = 0; i < normalData.length; i += 3) {
            normalData[i] = 0; 
            normalData[i + 1] = 1; 
            normalData[i + 2] = 0;
          }
        }

        // Get texture coordinates
        let texcoordData = new Float32Array((positionData.length / 3) * 2);
        if (primitive.attributes.TEXCOORD_0 !== undefined) {
          let tc = this.getAccessorArray(gltfData, buffers, primitive.attributes.TEXCOORD_0);
          if (!(tc instanceof Float32Array)) tc = new Float32Array(tc);
          texcoordData = tc;
        }

        const arrays = { 
          position: positionData, 
          normal: normalData, 
          texcoord: texcoordData 
        };
        
        if (primitive.indices !== undefined) {
          arrays.indices = this.getAccessorArray(gltfData, buffers, primitive.indices);
        }

        const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, arrays);

        prims.push({
          bufferInfo,
          texture: getBaseColorTexForPrimitive(primitive),
        });
      });
    });

    // Calculate model transformation
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxSize = Math.max(sizeX, sizeY, sizeZ);

    const modelScale = maxSize > 0 ? 2.0 / maxSize : 1.0;
    const modelOffset = [-centerX, -minY, -centerZ];

    console.log('GLTF primitives:', prims.length);
    
    return {
      primitives: prims,
      scale: modelScale,
      offset: modelOffset
    };
  }
}