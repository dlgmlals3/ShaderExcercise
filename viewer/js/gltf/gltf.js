/**
 * GLTF/GLB 로더 - 확장 가능한 프레임워크
 */

class GLTFLoader {
    constructor(gl, options = {}) {
        this.gl = gl;
        this.options = options;
        this.debug = false;

        // 데이터 저장소
        this.gltf = null;
        this.buffers = [];
        this.images = [];
        this.textures = [];
        this.samplers = [];
        this.materials = [];
        this.meshes = [];
        this.nodes = [];
        this.scenes = [];
        
        // 확장 기능 핸들러
        this.extensionHandlers = {};
        this.supportedExtensions = new Set();
        
        // 기본 확장 등록
        this._registerDefaultExtensions();
    }

    /**
     * 파일 로드 (GLB 또는 GLTF)
     */
    async load(file) {
        const arrayBuffer = await file.arrayBuffer();
        const magic = new Uint32Array(arrayBuffer, 0, 1)[0];
        
        if (magic === 0x46546C67) {
            return await this.loadGLB(arrayBuffer);
        } else {
            return await this.loadGLTF(arrayBuffer);
        }
    }

    /**
     * GLB 파일 로드
     */
    async loadGLB(arrayBuffer) {
        console.log("loadGLB: Starting GLB parsing");
        const view = new DataView(arrayBuffer);
        
        // 1. 헤더 파싱 (12 bytes)
        const magic = view.getUint32(0, true); // 0x46546C67 = "glTF"
        const version = view.getUint32(4, true); // GLB version (should be 2)
        const length = view.getUint32(8, true); // Total file length
        
        // 매직 넘버 검증
        if (magic !== 0x46546C67) {
            throw new Error('Invalid GLB file: Wrong magic number');
        }                
        let offset = 12; // 헤더 다음부터        
        const jsonChunkLength = view.getUint32(offset, true);
        const jsonChunkType = view.getUint32(offset + 4, true); // 0x4E4F534A = "JSON"
        
        if (jsonChunkType !== 0x4E4F534A) {
            throw new Error('Invalid GLB file: First chunk is not JSON');
        }
        
        offset += 8; // length + type
        
        // JSON 데이터 추출
        const jsonData = new Uint8Array(arrayBuffer, offset, jsonChunkLength);
        const jsonString = new TextDecoder().decode(jsonData);
        this.gltf = JSON.parse(jsonString);
        
        console.log("GLB JSON parsed:", this.gltf);
        
        offset += jsonChunkLength;
        
        // 3. BIN 청크 추출 (두 번째 청크, 옵셔널)
        if (offset < length) {
            const binChunkLength = view.getUint32(offset, true);
            const binChunkType = view.getUint32(offset + 4, true); // 0x004E4942 = "BIN\0"
            
            if (binChunkType === 0x004E4942) {
                offset += 8;
                this.buffers = [arrayBuffer.slice(offset, offset + binChunkLength)];                     
            }
        }        
        console.log("GLB loading complete");
        return this;
    }

    /**
     * GLTF 파일 로드
     */
    async loadGLTF(arrayBuffer) {
        // TODO: GLTF JSON 파싱
        // 외부 리소스는 지원 안함 (GLB 사용 권장)    
        return this;
    }

    // ==================== 데이터 접근 ====================
    
    /**
     * Accessor에서 데이터 추출
     */
    getAccessorData(accessorIndex) {
        // TODO: Accessor 데이터 추출
        // 1. accessor, bufferView 정보 가져오기
        // 2. componentType에 따라 TypedArray 생성
        // 3. stride, offset 처리
        
        const accessor = this.gltf.accessors[accessorIndex];
        const bufferView = this.gltf.bufferViews[accessor.bufferView];
        
        return null;
    }

    /**
     * BufferView에서 데이터 추출
     */
    getBufferViewData(bufferViewIndex) {
        // TODO: BufferView 데이터 추출
        
        const bufferView = this.gltf.bufferViews[bufferViewIndex];
        
        return null;
    }

    /**
     * ComponentType에 따른 TypedArray 클래스 반환
     */
    getTypedArrayConstructor(componentType) {
        // TODO: componentType -> TypedArray 매핑
        // 5120: Int8Array
        // 5121: Uint8Array
        // 5122: Int16Array
        // 5123: Uint16Array
        // 5125: Uint32Array
        // 5126: Float32Array
        
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

    /**
     * Accessor Type에 따른 컴포넌트 개수 반환
     */
    getComponentCount(type) {
        // TODO: type -> component count 매핑
        // SCALAR: 1
        // VEC2: 2
        // VEC3: 3
        // VEC4: 4
        // MAT2: 4
        // MAT3: 9
        // MAT4: 16
        
        const counts = {
            'SCALAR': 1,
            'VEC2': 2,
            'VEC3': 3,
            'VEC4': 4,
            'MAT2': 4,
            'MAT3': 9,
            'MAT4': 16
        };
        
        return counts[type] || 1;
    }

    // ==================== 이미지 & 텍스처 ====================
    
    /**
     * 이미지 로드
     */
    async loadImages() {
        if (!this.gltf.images) return;
        
        const imagePromises = this.gltf.images.map((img, idx) => {
            return this._loadImage(img, idx);
        });        
        this.images = await Promise.all(imagePromises);
        if (this.debug) {
            this.images.forEach((img, idx) => {
                console.log(`Image ${idx}:`, {
                    width: img.width,
                    height: img.height,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    complete: img.complete,
                    src: img.src
                });
            });
        }
        
    }

    /**
     * 단일 이미지 로드
     */
    async _loadImage(imageInfo, index) {
        try {
            // URI 방식 (data URI 또는 외부 파일)
            if (imageInfo.uri) {
                const uri = imageInfo.uri;
                
                return new Promise((resolve, reject) => {
                    const image = new Image();
                    
                    // Data URI가 아닌 외부 파일인 경우 CORS 설정
                    if (!uri.startsWith('data:')) {
                        image.crossOrigin = 'anonymous';
                        // baseUri가 설정되어 있다면 결합
                        const fullUri = this.baseUri ? new URL(uri, this.baseUri).href : uri;
                        image.src = fullUri;
                    } else {
                        image.src = uri;
                    }
                    
                    image.onload = () => {                        
                        resolve(image);
                    };
                    
                    image.onerror = (error) => {
                        console.error(`Failed to load image ${index}:`, error);
                        reject(new Error(`Failed to load image ${index}`));
                    };
                });
            }
            
            // bufferView 방식 (GLB 내장)
            if (imageInfo.bufferView !== undefined) {                
                // 1. bufferView에서 데이터 추출
                const bufferView = this.gltf.bufferViews[imageInfo.bufferView];
                const buffer = this.buffers[bufferView.buffer || 0];
                
                const offset = bufferView.byteOffset || 0;
                const length = bufferView.byteLength;                
                
                // 이미지 데이터 추출
                const imageData = new Uint8Array(buffer, offset, length);
                                
                // 2. mimeType 확인
                const mimeType = imageInfo.mimeType || 'image/png';
                
                // 3. Blob 생성
                const blob = new Blob([imageData], { type: mimeType });                
                
                // 4. Image 객체 생성 및 로드
                const imageUrl = URL.createObjectURL(blob);
                
                return new Promise((resolve, reject) => {
                    const image = new Image();
                    
                    image.onload = () => {
                        // Blob URL 참조 저장 (나중에 정리용)
                        image._blobUrl = imageUrl;
                        resolve(image);
                    };
                    
                    image.onerror = (error) => {
                        console.error(`Failed to load image ${index} from blob:`, error);
                        URL.revokeObjectURL(imageUrl);
                        reject(new Error(`Failed to load image ${index} from blob`));
                    };
                    
                    image.src = imageUrl;
                });
            }
            
            throw new Error(`Image ${index}: No valid source (uri or bufferView)`);
            
        } catch (error) {
            console.error(`Error loading image ${index}:`, error);
            throw error;
        }
    }
    /**
     * 텍스처 생성
     */
    createTextures() {
        if (!this.gltf.textures) {
            console.log("No textures to create");
            this.textures = [];
            return;
        }

        const gl = this.gl;
        this.textures = [];
        
        for (let i = 0; i < this.gltf.textures.length; i++) {
            const textureInfo = this.gltf.textures[i];
            
            // 1. 이미지 가져오기
            const imageIndex = textureInfo.source;
            if (imageIndex === undefined) {
                console.warn(`Texture ${i}: No source image specified`);
                this.textures.push(null);
                continue;
            }
            
            const image = this.images[imageIndex];
            if (!image) {
                console.warn(`Texture ${i}: Image ${imageIndex} not found`);
                this.textures.push(null);
                continue;
            }
            
            // 2. WebGL 텍스처 생성
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            
            // 3. 이미지 데이터 업로드
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,                  // mipmap level
                gl.RGBA,            // internal format
                gl.RGBA,            // format
                gl.UNSIGNED_BYTE,   // type
                image               // 이미지 데이터
            );
            
            // 4. Sampler 파라미터 설정
            const samplerIndex = textureInfo.sampler;
            let sampler = null;
            
            if (samplerIndex !== undefined && this.gltf.samplers) {
                sampler = this.gltf.samplers[samplerIndex];                
            } 
            
            // Wrap 모드 설정
            const wrapS = sampler?.wrapS || gl.REPEAT;
            const wrapT = sampler?.wrapT || gl.REPEAT;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);

            // Filter 모드 설정
            const magFilter = sampler?.magFilter || gl.LINEAR;
            const minFilter = sampler?.minFilter || gl.LINEAR_MIPMAP_LINEAR;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);

            // Mipmap 생성 (minFilter가 mipmap을 사용하는 경우)
            if (minFilter === gl.NEAREST_MIPMAP_NEAREST ||
                minFilter === gl.LINEAR_MIPMAP_NEAREST ||
                minFilter === gl.NEAREST_MIPMAP_LINEAR ||
                minFilter === gl.LINEAR_MIPMAP_LINEAR) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }
            
            // 바인딩 해제
            gl.bindTexture(gl.TEXTURE_2D, null);
            
            // 텍스처 저장
            this.textures.push({
                texture: texture,
                image: image,
                sampler: sampler,
                index: i
            });
            
            // Blob URL 정리 (메모리 절약)
            if (image._blobUrl) {
                URL.revokeObjectURL(image._blobUrl);
                delete image._blobUrl;
            }
        }
        
        if (this.debug) {
            this.textures.forEach((texture, idx) => {
                texture.texture
                console.log(`Image ${idx}:`, {
                    texture: texture.texture,
                    image: texture.image,       
                    sampler: texture.sampler,
                    index: texture.index         
                });            
            });
        }
    
    }

    parseMaterials() {
        // TODO: 모든 머티리얼 파싱
        // 1. gltf.materials 순회
        // 2. PBR parameters 추출
        // 3. 텍스처 인덱스 저장
        // 4. 확장 기능 처리
        
        if (!this.gltf.materials) {
            console.log("No materials to parse");
            this.materials = [];
            return;
        }    
        this.materials = [];
        
        for (let i = 0; i < this.gltf.materials.length; i++) {
            const matInfo = this.gltf.materials[i];            
            const material = {
                name: matInfo.name || `Material_${i}`,
                index: i
            };
            
            // PBR Metallic Roughness 파라미터
            if (matInfo.pbrMetallicRoughness) {
                const pbr = matInfo.pbrMetallicRoughness;
                
                // Base Color
                material.baseColorFactor = pbr.baseColorFactor || [1, 1, 1, 1];
                material.baseColorTexture = pbr.baseColorTexture?.index;
                material.baseColorTexCoord = pbr.baseColorTexture?.texCoord || 0;
                
                // Metallic & Roughness
                material.metallicFactor = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 1.0;
                material.roughnessFactor = pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1.0;
                material.metallicRoughnessTexture = pbr.metallicRoughnessTexture?.index;
                material.metallicRoughnessTexCoord = pbr.metallicRoughnessTexture?.texCoord || 0;
            }
            
            // Normal Map
            if (matInfo.normalTexture) {
                material.normalTexture = matInfo.normalTexture.index;
                material.normalTexCoord = matInfo.normalTexture.texCoord || 0;
                material.normalScale = matInfo.normalTexture.scale || 1.0;
            }
            
            // Occlusion Map
            if (matInfo.occlusionTexture) {
                material.occlusionTexture = matInfo.occlusionTexture.index;
                material.occlusionTexCoord = matInfo.occlusionTexture.texCoord || 0;
                material.occlusionStrength = matInfo.occlusionTexture.strength || 1.0;
            }
            
            // Emissive
            material.emissiveFactor = matInfo.emissiveFactor || [0, 0, 0];
            if (matInfo.emissiveTexture) {
                material.emissiveTexture = matInfo.emissiveTexture.index;
                material.emissiveTexCoord = matInfo.emissiveTexture.texCoord || 0;
            }
            
            // Alpha Mode
            material.alphaMode = matInfo.alphaMode || 'OPAQUE';
            material.alphaCutoff = matInfo.alphaCutoff || 0.5;
            material.doubleSided = matInfo.doubleSided || false;
            
            // 확장 기능 (예: KHR_materials_unlit 등)
            if (matInfo.extensions) {
                material.extensions = matInfo.extensions;            
            }
            
            this.materials.push(material);
        }
        if (this.debug) {
            this.materials.forEach((material, idx) => {
                console.log(`material '${idx} : ` + JSON.stringify(material, null, 2));
            });
        }    
    }

    parseMeshes() {
        if (!this.gltf.meshes) {
            console.log("No meshes to parse");
            this.meshes = [];
            return;
        }
        
        this.meshes = [];
        
        for (let i = 0; i < this.gltf.meshes.length; i++) {
            const meshInfo = this.gltf.meshes[i];        
            const mesh = {
                name: meshInfo.name || `Mesh_${i}`,
                index: i,
                primitives: []
            };
            
            // 각 primitive 파싱
            if (!meshInfo.primitives || meshInfo.primitives.length === 0) {                
                this.meshes.push(mesh);
                continue;
            }
            
            for (let j = 0; j < meshInfo.primitives.length; j++) {
                const primInfo = meshInfo.primitives[j];
 
                const primitive = {
                    index: j,
                    mode: primInfo.mode !== undefined ? primInfo.mode : 4, // 4 = TRIANGLES
                    material: primInfo.material,
                    attributes: {},
                    indices: primInfo.indices
                };
                
                // Attributes 파싱 (POSITION, NORMAL, TEXCOORD_0 등)
                if (primInfo.attributes) {
                    for (const [attrName, accessorIndex] of Object.entries(primInfo.attributes)) {
                        primitive.attributes[attrName] = accessorIndex;
                    }
                }
     
                // Targets (Morph targets)
                if (primInfo.targets) {
                    primitive.targets = primInfo.targets;
                }
                
                mesh.primitives.push(primitive);
            }
            
            // Mesh weights (Morph target weights)
            if (meshInfo.weights) {
                mesh.weights = meshInfo.weights;
            }
            
            this.meshes.push(mesh);
        }
        if (this.debug) {
            this.meshes.forEach((mesh, idx) => {    
                console.log(`Mesh[${idx}]:`, mesh);
            });    
        }        
    }

    // ==================== Scene & Node ====================
    
    /**
     * Scene 파싱
     */
    parseScenes() {
        // TODO: Scene 파싱
        // 1. gltf.scenes 순회
        // 2. rootNodes 저장
        
        //if (!this.gltf.scenes) return;
    }

    /**
     * Node 파싱
     */
    parseNodes() {
        // TODO: Node 파싱
        // 1. gltf.nodes 순회
        // 2. transform (matrix 또는 TRS)
        // 3. mesh, camera, skin, children
        
        //if (!this.gltf.nodes) return;
    }

    /**
     * Node Transform 계산
     */
    getNodeTransform(nodeIndex) {
        // TODO: Node의 world transform 계산
        // 1. matrix 또는 TRS에서 local transform 생성
        // 2. parent transforms 곱하기
        
        return null;
    }

    // ==================== 애니메이션 ====================
    
    /**
     * 애니메이션 파싱
     */
    parseAnimations() {
        // TODO: 애니메이션 파싱
        // 1. gltf.animations 순회
        // 2. samplers, channels 파싱
        
        //if (!this.gltf.animations) return;
    }

    // ==================== Skin ====================
    
    /**
     * Skin 파싱
     */
    parseSkins() {
        // TODO: Skin 파싱
        // 1. gltf.skins 순회
        // 2. joints, inverseBindMatrices
        
        //if (!this.gltf.skins) return;
    }

    // ==================== 확장 기능 ====================
    
    /**
     * 기본 확장 등록
     */
    _registerDefaultExtensions() {
        // TODO: 기본 확장 등록
        
        // KHR_materials_pbrSpecularGlossiness
        this.registerExtension('KHR_materials_pbrSpecularGlossiness', {
            parseMaterial: (material, extensionData) => {
                // TODO
            }
        });
        
        // KHR_materials_unlit
        this.registerExtension('KHR_materials_unlit', {
            parseMaterial: (material, extensionData) => {
                // TODO
            }
        });
        
        // KHR_materials_transmission
        this.registerExtension('KHR_materials_transmission', {
            parseMaterial: (material, extensionData) => {
                // TODO
            }
        });
        
        // KHR_draco_mesh_compression
        this.registerExtension('KHR_draco_mesh_compression', {
            parsePrimitive: (primitive, extensionData) => {
                // TODO: Draco 디코딩
            }
        });
        
        // KHR_texture_basisu
        this.registerExtension('KHR_texture_basisu', {
            loadImage: (imageInfo, extensionData) => {
                // TODO: Basis Universal 디코딩
            }
        });
    }

    /**
     * 확장 기능 등록
     */
    registerExtension(name, handler) {
        // TODO: 확장 핸들러 등록
        
        this.extensionHandlers[name] = handler;
        this.supportedExtensions.add(name);
    }

    /**
     * 전체 파싱 실행
     */
    async parse() {        
        await this.loadImages();

        this.createTextures();
        this.parseMaterials();
        this.parseMeshes();
        this.parseNodes();
        this.parseScenes();
        this.parseAnimations();
        this.parseSkins();
        
        console.log("Creating buffer infos...");
        const bufferCreator = new BufferInfoCreator(this.gl, this.gltf, this.buffers);
        bufferCreator.createAllBufferInfos(this.meshes, this.materials, this.textures);
        
        return {
            meshes: this.meshes,
            materials: this.materials,
            scenes: this.scenes,
            nodes: this.nodes,
            animations: this.animations,
        };
    }
}