/** Result of speech synthesis — path to audio file and measured duration. */
export interface TtsResult {
  audioPath: string;
  /** Duration in seconds (from encoder / probe). */
  durationSec: number;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(script: string, outBasePath: string): Promise<TtsResult>;
}
