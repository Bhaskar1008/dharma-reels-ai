/** Result of speech synthesis — path to audio file and measured duration. */
export interface TtsResult {
  audioPath: string;
  /** Duration in seconds (from encoder / probe). */
  durationSec: number;
}

export interface TtsSynthesizeOptions {
  /** OpenAI voice id, e.g. onyx, nova */
  voice?: string;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(script: string, outBasePath: string, options?: TtsSynthesizeOptions): Promise<TtsResult>;
}
