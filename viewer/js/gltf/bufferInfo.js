// BufferInfoCreator.js

// dlgmlals3 bufferInfoCreate보자.

class BufferInfoCreator {
    constructor(gl, gltf, buffers) {
        this.gl = gl;
        this.gltf = gltf;
        this.buffers = buffers;
    }

    /**
     * Accessor에서 데이터 추출
     */
    getAccessorData(accessorIndex) {
        const accessor = this.gltf.accessors[accessorIndex];
        const bufferView = this.gltf.bufferViews[accessor.bufferView];
        const buffer = this.buffers[bufferView.buffer || 0];
        
        const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const componentType = accessor.componentType;
        const count = accessor.count;
        const type = accessor.type;
        
        // ComponentType에 따라 TypedArray 선택
        let TypedArray;
        switch(componentType) {
            case 5126: // FLOAT
                TypedArray = Float32Array;
                break;
            case 5123: // UNSIGNED_SHORT
                TypedArray = Uint16Array;
                break;
            case 5125: // UNSIGNED_INT
                TypedArray = Uint32Array;
                break;
            case 5121: // UNSIGNED_BYTE
                TypedArray = Uint8Array;
                break;
            case 5120: // BYTE
                TypedArray = Int8Array;
                break;
            case 5122: // SHORT
                TypedArray = Int16Array;
                break;
            default:
                throw new Error(`Unsupported componentType: ${componentType}`);
        }
        
        // Type에 따라 component 개수 결정
        const componentCount = {
            'SCALAR': 1,
            'VEC2': 2,
            'VEC3': 3,
            'VEC4': 4,
            'MAT2': 4,
            'MAT3': 9,
            'MAT4': 16
        }[type];
        
        const totalComponents = count * componentCount;
        
        return new TypedArray(buffer, offset, totalComponents);
    }

    /**
     * GLTF attribute name을 WebGL attribute name으로 변환
     */
    getGLAttributeName(gltfAttrName) {
        const mapping = {
            'POSITION': 'position',
            'NORMAL': 'normal',
            'TANGENT': 'tangent',
            'TEXCOORD_0': 'texcoord',
            'TEXCOORD_1': 'texcoord1',
            'COLOR_0': 'color',
            'JOINTS_0': 'joints',
            'WEIGHTS_0': 'weights'
        };
        
        return mapping[gltfAttrName] || gltfAttrName.toLowerCase();
    }

    /**
     * Primitive에 대한 BufferInfo 생성
     */
    createBufferInfo(primitive) {
        const gl = this.gl;
        const arrays = {};
        
        console.log('Creating bufferInfo for primitive:', primitive);
        
        // Attributes 처리
        for (const [attrName, accessorIndex] of Object.entries(primitive.attributes)) {
            const data = this.getAccessorData(accessorIndex);
            const accessor = this.gltf.accessors[accessorIndex];
            
            // GLTF attribute name을 WebGL attribute name으로 변환
            const glAttrName = this.getGLAttributeName(attrName);
            
            const componentCount = {
                'SCALAR': 1,
                'VEC2': 2,
                'VEC3': 3,
                'VEC4': 4
            }[accessor.type];
            
            arrays[glAttrName] = {
                numComponents: componentCount,
                data: data
            };
            
            console.log(`  Attribute ${attrName} → ${glAttrName}:`, {
                numComponents: componentCount,
                dataLength: data.length
            });
        }
        
        // Indices 처리
        if (primitive.indices !== undefined) {
            const indexData = this.getAccessorData(primitive.indices);
            arrays.indices = {
                data: indexData
            };
        }
        
        // webgl-utils의 createBufferInfoFromArrays 형식으로 변환
        const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, arrays);
        
        console.log('BufferInfo created:', bufferInfo);
        
        return bufferInfo;
    }

    /**
     * 모든 메쉬에 대해 BufferInfo 생성
     */
    createAllBufferInfos(meshes, materials, textures) {  
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            
            for (let j = 0; j < mesh.primitives.length; j++) {
                const primitive = mesh.primitives[j];
                
                console.log(`Creating BufferInfo for Mesh[${i}] Primitive[${j}]`);
                
                // BufferInfo 생성 및 저장
                primitive.bufferInfo = this.createBufferInfo(primitive);
                
                // Material과 Texture 연결
                if (primitive.material !== undefined) {
                    const material = materials[primitive.material];
                    
                    // Texture 참조 저장
                    if (material.baseColorTexture !== undefined) {
                        const textureObj = textures[material.baseColorTexture];
                        primitive.texture = textureObj.texture;
                    }
                    
                    // Material 객체 저장
                    primitive.material = material;
                }
            }
        }
    }
}