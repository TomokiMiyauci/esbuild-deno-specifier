export type Sentence = string | (() => string);

export class Writer {
  #sentences: Sentence[] = [];
  addLine(sentence: Sentence): void {
    this.#sentences.push(sentence);
  }

  *[Symbol.iterator](): Iterable<string> {
    for (const sentence of this.#sentences) {
      if (typeof sentence === "string") yield sentence;
      else yield sentence();
    }
  }

  done(): string {
    return [...this[Symbol.iterator]()].join("\n");
  }
}
