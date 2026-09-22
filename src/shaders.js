// Vertex Shader: Posição + Coordenadas de Textura
export const vsSource = `#version 300 es
in vec2 a_position;
in vec2 a_texcoord;

uniform vec2 u_resolution;
uniform vec2 u_translation;
uniform vec2 u_scale;

out vec2 v_texcoord;

void main() {
    vec2 position = (a_position * u_scale) + u_translation;
    vec2 zeroToOne = position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
    v_texcoord = a_texcoord;
}
`;

// Fragment Shader: Amostragem de Textura ou Cor Sólida
export const fsSource = `#version 300 es
precision mediump float;

in vec2 v_texcoord;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform bool u_useTexture;

out vec4 outColor;

void main() {
    if (u_useTexture) {
        outColor = texture(u_texture, v_texcoord);
    } else {
        outColor = u_color;
    }
}
`;

export function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Erro ao compilar shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

export function createProgram(gl, vsSource, fsSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Erro ao linkar program:", gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

export function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

    const image = new Image();
    image.src = url;
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };

    return texture;
}