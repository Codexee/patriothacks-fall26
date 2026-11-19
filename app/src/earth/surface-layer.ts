// A deck.gl layer that draws the Surface mesh (see surface.ts) with one draw call.
//
// The geometry and the blend weights go to the GPU one time. A replay step sends only one small
// texture: 4 numbers per county (share out, alert, extra depth). The vertex shader reads the values of
// the 4 counties of each vertex from that texture and blends them. The fragment shader gives a soft
// light from the slope (smooth normals, no facets) and the outage color.
// Picking is by county: each vertex carries the index of its county.
import { Layer, project32, picking } from 'deck.gl';
import type { LayerProps, UpdateParameters, DefaultProps } from '@deck.gl/core';
import { Model } from '@luma.gl/engine';
import { Buffer } from '@luma.gl/core';
import type { Texture } from '@luma.gl/core';
import type { Surface } from './surface.ts';

type RGB = [number, number, number];

/** The county texture is this wide; county i is at (i % width, floor(i / width)). */
export const COUNTY_TEXTURE_WIDTH = 64;
export const countyTextureSize = (counties: number) => COUNTY_TEXTURE_WIDTH * Math.ceil(counties / COUNTY_TEXTURE_WIDTH) * 4;

export interface SurfaceLayerProps extends LayerProps {
  surface: Surface;
  /** unorm8 x 4 per vertex: the blended base color; then 0 = surface, 128 = coast wall, 255 = coast wall at the base plane. */
  colors: Uint8Array;
  /** float32 x 3 per vertex, fixed: depth in metres, slope to the east, slope to the north (metres per common unit). */
  relief: Float32Array;
  /** float32 x 4 per county (length countyTextureSize): share of customers out 0..1, alert 0 or 1, extra depth in metres, 0. */
  countyData: Float32Array;
  /** A change of this value sends countyData to the GPU. */
  countyVersion: number;
  /** Common units of z per (metre x unitsPerMetre). Negative = the surface goes down. */
  zScale: number;
  /** How much the slope changes the light. 0 = flat color; 1 = the true slope. */
  reliefLight: number;
  /** 0..1: how dark a county that is fully out is on its whole area, before the blend with its neighbors. */
  ownShare: number;
  dark: RGB;
  alert: RGB;
}

const uniformBlock = `\
layout(std140) uniform surfaceUniforms {
  float zScale;
  float reliefLight;
  float ownShare;
  vec3 dark;
  vec3 alert;
} surface;
`;
const surfaceUniforms = {
  name: 'surface',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: { zScale: 'f32', reliefLight: 'f32', ownShare: 'f32', dark: 'vec3<f32>', alert: 'vec3<f32>' },
} as const;

const vs = `\
#version 300 es
#define SHADER_NAME surface-layer-vertex-shader
in vec3 positions;
in vec3 relief;
in vec4 colors;
in vec4 blendIds;
in vec4 blendWeights;
in vec4 blendSlopeX;
in vec4 blendSlopeY;
in float pickIndex;
uniform highp sampler2D countyData;
out vec3 vColor;
out vec2 vSlope;
out vec4 vStatus;
vec4 county(float index) {
  int i = int(index + 0.5);
  return texelFetch(countyData, ivec2(i % ${COUNTY_TEXTURE_WIDTH}, i / ${COUNTY_TEXTURE_WIDTH}), 0);
}
void main(void) {
  vec4 own = county(pickIndex);
  vec4 c0 = county(blendIds.x), c1 = county(blendIds.y), c2 = county(blendIds.z), c3 = county(blendIds.w);
  vec4 outs = vec4(c0.x, c1.x, c2.x, c3.x);
  vec4 extra = vec4(c0.z, c1.z, c2.z, c3.z);
  float depth = relief.x + dot(blendWeights, extra);
  vec2 slope = relief.yz + vec2(dot(blendSlopeX, extra), dot(blendSlopeY, extra));

  // colors.a: 0 = surface, 0.5 = coast wall at the surface, 1 = coast wall at the base plane.
  float base = step(0.75, colors.a);
  float k = positions.z * surface.zScale;
  vec3 pos = vec3(positions.xy, depth * k * (1.0 - base));
  geometry.worldPosition = pos;
  geometry.pickingColor = picking_getPickingColorFromIndex(pickIndex);
  gl_Position = project_position_to_clipspace(pos, vec3(0.0), vec3(0.0), geometry.position);
  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
  vSlope = slope * k;
  vStatus = vec4(own.x, own.y, dot(blendWeights, outs), colors.a);
  vec4 color = vec4(colors.rgb, 1.0);
  DECKGL_FILTER_COLOR(color, geometry);
  vColor = color.rgb;
}
`;

const fs = `\
#version 300 es
#define SHADER_NAME surface-layer-fragment-shader
precision highp float;
in vec3 vColor;
in vec2 vSlope;
in vec4 vStatus;
out vec4 fragColor;
void main(void) {
  // A soft light from the north-west. A flat place keeps its color (shade = 1).
  vec3 normal = normalize(vec3(-vSlope * surface.reliefLight, 1.0));
  float facing = dot(normal, vec3(-0.451, 0.551, 0.702));
  float shade = clamp(0.56 + 0.627 * facing, 0.42, 1.3);
  vec3 color = vColor * shade;
  // The coast wall: dim at the surface, almost black at the base plane.
  float wall = step(0.25, vStatus.w);
  color = mix(color, vColor * mix(0.5, 0.05, clamp(vStatus.w * 2.0 - 1.0, 0.0, 1.0)), wall);
  // Outage. x is the share out of the county itself (the same on its whole area); z is that share
  // blended with the neighbors, which gives a soft edge. The county's own value sets a floor, so a
  // county that is fully out is dark on its whole area. A band of the alert color shows where the
  // share is partial: around a dark region, and on counties that are partly out.
  // The clamp is necessary: at the edge of a thin triangle the blend can go a little below 0, and pow() of
  // a negative number has no result (a black pixel).
  float own = clamp(vStatus.x, 0.0, 1.0), blend = clamp(vStatus.z, 0.0, 1.0);
  float out_ = pow(max(own * own * own * surface.ownShare, blend * blend), 0.55);
  color = mix(color, surface.dark, out_ * (1.0 - wall * 0.5));
  float band = pow(4.0 * blend * (1.0 - blend), 1.5) * (1.0 - 0.7 * own);
  color += surface.alert * (0.5 * band + 0.06 * vStatus.y) * (1.0 - wall);
  fragColor = vec4(color, layer.opacity);
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

type OwnProps = Required<Omit<SurfaceLayerProps, keyof LayerProps>>;

const defaultProps: DefaultProps<OwnProps> = {
  countyVersion: 0,
  zScale: -1,
  reliefLight: 1,
  ownShare: 0.9,
  dark: [0, 0, 0],
  alert: [1, 0.35, 0.3],
};

type State = { model?: Model; texture?: Texture; buffers?: Buffer[] };

export class SurfaceLayer extends Layer<OwnProps> {
  static layerName = 'SurfaceLayer';
  static defaultProps = defaultProps;
  declare state: State & Layer['state'];

  getShaders() {
    return super.getShaders({ vs, fs, modules: [project32, picking, surfaceUniforms] });
  }

  /** The mesh has no instances. */
  getNumInstances() { return 0; }

  initializeState() {
    const { device } = this.context;
    const { surface, colors, relief, countyData } = this.props;
    const pick = new Float32Array(surface.count);
    for (let i = 0; i < surface.count; i++) pick[i] = surface.county[i];
    const weights = new Uint8Array(surface.count * 4);
    for (let i = 0; i < weights.length; i++) weights[i] = Math.round(surface.blendW[i] * 255);
    const attributes = {
      positions: device.createBuffer({ data: surface.positions }),
      relief: device.createBuffer({ data: relief }),
      colors: device.createBuffer({ data: colors }),
      blendIds: device.createBuffer({ data: surface.blendId }),
      blendWeights: device.createBuffer({ data: weights }),
      blendSlopeX: device.createBuffer({ data: surface.blendX }),
      blendSlopeY: device.createBuffer({ data: surface.blendY }),
      pickIndex: device.createBuffer({ data: pick }),
    };
    const indexBuffer = device.createBuffer({ usage: Buffer.INDEX, indexType: 'uint32', data: surface.indices });
    const texture = device.createTexture({
      format: 'rgba32float', width: COUNTY_TEXTURE_WIDTH, height: countyData.length / 4 / COUNTY_TEXTURE_WIDTH,
      data: countyData, mipLevels: 1, sampler: { minFilter: 'nearest', magFilter: 'nearest' },
    });
    const model = new Model(device, {
      ...this.getShaders(),
      id: this.props.id,
      topology: 'triangle-list',
      isInstanced: false,
      bufferLayout: [
        { name: 'positions', format: 'float32x3' },
        { name: 'relief', format: 'float32x3' },
        { name: 'colors', format: 'unorm8x4' },
        { name: 'blendIds', format: 'float32x4' },
        { name: 'blendWeights', format: 'unorm8x4' },
        { name: 'blendSlopeX', format: 'float32x4' },
        { name: 'blendSlopeY', format: 'float32x4' },
        { name: 'pickIndex', format: 'float32' },
      ],
      attributes,
      indexBuffer,
      vertexCount: surface.indices.length,
      bindings: { countyData: texture },
    });
    this.setState({ model, texture, buffers: [...Object.values(attributes), indexBuffer] });
  }

  updateState({ props, oldProps }: UpdateParameters<this>) {
    const { texture } = this.state;
    if (texture && oldProps.surface !== undefined && props.countyVersion !== oldProps.countyVersion) texture.writeData(props.countyData);
  }

  draw() {
    const { model } = this.state;
    if (!model) return;
    const { zScale, reliefLight, ownShare, dark, alert } = this.props;
    model.shaderInputs.setProps({ surface: { zScale, reliefLight, ownShare, dark, alert } });
    model.draw(this.context.renderPass);
  }

  finalizeState(context: Parameters<Layer['finalizeState']>[0]) {
    super.finalizeState(context);
    for (const b of this.state.buffers ?? []) b.destroy();
    this.state.texture?.destroy();
  }
}
