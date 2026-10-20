import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Platform } from 'react-native';

import { ATTACHMENT_COMPRESSION, compressForUpload, readBytes } from '@/lib/images';

/**
 * Fake manipulator: a mockPhoto of `mockPhoto` px; the encoded JPEG weighs `mockBytesPerPixel × quality` per pixel,
 * so the test controls when an image is over budget.
 */
type MockImage = { width: number; height: number; saveAsync: (o: { compress: number }) => Promise<{ uri: string; width: number; height: number }> };
const mockPhoto = { width: 4000, height: 3000 };
let mockBytesPerPixel = 0.1;
const mockSaved = new Map<string, number>();
const mockSaves: { width: number; height: number; compress: number }[] = [];

function mockImage(width: number, height: number): MockImage {
  return {
    width,
    height,
    saveAsync: async ({ compress }) => {
      const uri = `file:///out-${mockSaves.length}.jpg`;
      mockSaves.push({ width, height, compress });
      mockSaved.set(uri, Math.round(width * height * mockBytesPerPixel * compress));
      return { uri, width, height };
    },
  };
}

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-file-system', () => ({
  File: class {
    constructor(readonly mockUri: string) {}
    async arrayBuffer() {
      return new ArrayBuffer(mockSaved.get(this.mockUri) ?? 0);
    }
  },
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (source: string | MockImage, options?: { maxWidth?: number; maxHeight?: number }) => {
      let next = typeof source === 'string' ? mockImage(mockPhoto.width, mockPhoto.height) : source;
      return {
        resize(size: { width?: number; height?: number }) {
          const scale = size.width ? size.width / next.width : (size.height ?? next.height) / next.height;
          next = mockImage(Math.round(next.width * scale), Math.round(next.height * scale));
          return this;
        },
        async renderAsync() {
          // Decode-time downsampling is coarse (power of two), like the native decoder.
          let image = next;
          const limit = Math.min(options?.maxWidth ?? Infinity, options?.maxHeight ?? Infinity);
          while (Math.max(image.width, image.height) / 2 >= limit) image = mockImage(image.width / 2, image.height / 2);
          return image;
        },
      };
    },
  },
}));

beforeEach(() => {
  mockBytesPerPixel = 0.1;
  mockSaved.clear();
  mockSaves.length = 0;
  mockPhoto.width = 4000;
  mockPhoto.height = 3000;
});

describe('compressForUpload', () => {
  it('downscales the long edge to maxEdge in one pass when under budget', async () => {
    const out = await compressForUpload({ uri: 'file:///in.jpg' });
    expect(Math.max(out.width, out.height)).toBe(2560);
    expect(mockSaves).toHaveLength(1);
    expect(mockSaves[0].compress).toBe(0.82);
    expect(out.bytes.byteLength).toBeLessThanOrEqual(1_500_000);
  });

  it('sizes portrait photos by height, from real pixels', async () => {
    mockPhoto.width = 3000;
    mockPhoto.height = 4000;
    const out = await compressForUpload({ uri: 'file:///in.jpg' });
    expect(out.height).toBe(2560);
    expect(out.width).toBe(1920);
  });

  it('leaves small images at their size', async () => {
    mockPhoto.width = 1200;
    mockPhoto.height = 900;
    const out = await compressForUpload({ uri: 'file:///in.jpg' });
    expect(out).toMatchObject({ width: 1200, height: 900 });
  });

  it('re-encodes smaller until the JPEG fits the budget', async () => {
    mockBytesPerPixel = 0.5; // very detailed board: 2560×1920 @ 0.82 ≈ 2 MB
    const out = await compressForUpload({ uri: 'file:///in.jpg' });
    expect(mockSaves.length).toBeGreaterThan(1);
    expect(out.bytes.byteLength).toBeLessThanOrEqual(1_500_000);
    expect(mockSaves[1].compress).toBeCloseTo(0.72);
    expect(Math.max(mockSaves[1].width, mockSaves[1].height)).toBe(2048);
  });

  it('stops after the last attempt and never goes below the floors', async () => {
    mockBytesPerPixel = 100;
    const out = await compressForUpload({ uri: 'file:///in.jpg' });
    expect(mockSaves).toHaveLength(4);
    expect(Math.max(out.width, out.height)).toBeGreaterThanOrEqual(1024);
    expect(mockSaves[3].compress).toBeGreaterThanOrEqual(0.5);
  });

  it('uses the attachment preset (≤ 1600 px)', async () => {
    const out = await compressForUpload({ uri: 'file:///in.jpg' }, ATTACHMENT_COMPRESSION);
    expect(Math.max(out.width, out.height)).toBe(1600);
  });
});

describe('readBytes', () => {
  it('reads blob: URLs with fetch on web, where expo-file-system is a stub', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    try {
      const bytes = await readBytes('blob:http://localhost:8081/abc');
      expect(fetchMock).toHaveBeenCalledWith('blob:http://localhost:8081/abc');
      expect(bytes.byteLength).toBe(3);
    } finally {
      fetchMock.mockRestore();
      os.restore();
    }
  });
});
