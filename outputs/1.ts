import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MergeOptions {
    inputPaths: string[];
    outputPath: string;
    resolution?: string;
    bitrate?: string;
    frameRate?: number;
}

export async function mergeVideos(options: MergeOptions): Promise<void> {
    const filterComplex = options.inputPaths
        .map((_, index) => `[${index}:v] [${index}:a]`)
        .join(' ');

    const ffmpegCommand = [
        'ffmpeg',
        ...options.inputPaths.flatMap(path => ['-i', path]),
        '-filter_complex',
        `"${filterComplex} concat=n=${options.inputPaths.length}:v=1:a=1 [v] [a]"`,
        '-map', '[v]',
        '-map', '[a]',
        options.resolution && `-vf scale=${options.resolution}`,
        options.bitrate && `-b:v ${options.bitrate}`,
        options.frameRate && `-r ${options.frameRate}`,
        '-c:v libx264',
        '-preset fast',
        '-y',
        options.outputPath
    ].filter(Boolean).join(' ');

    try {
        const { stdout, stderr } = await execAsync(ffmpegCommand);
        console.log('视频合并成功:', stdout);
    } catch (error) {
        throw new Error(`视频合并失败: ${error}`);
    }
}
