import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

export async function mergeVideos(options: MergeOptions): Promise<string> {
    const { inputs, output = './output.mp4', onProgress } = options;

    return new Promise((resolve, reject) => {
        const command = ffmpeg();

        inputs.forEach(input => command.input(input));

        command
            .on('start', (cmd) => console.log(`FFmpeg命令: ${cmd}`))
            .on('progress', (progress) => {
                const percent = progress.percent / 100;
                onProgress?.(Math.min(percent, 0.99));
            })
            .on('end', () => {
                onProgress?.(1);
                resolve(output);
            })
            .on('error', (err) => reject(err))
            .outputOptions([
                '-f concat',
                '-safe 0',
                '-c copy',
                '-vsync 2',
                '-map 0:v',
                '-map 1:a',
                '-vf scale=w=trunc(iw/2)*2:h=trunc(ih/2)*2',
                '-movflags +faststart'
            ])
            .save(output);
    });
}
