/** One line of recognised text and its box as fractions (0..1) of the image, from the top-left corner. */
export interface RecognisedLine {
  text: string;
  box: { x: number; y: number; width: number; height: number };
}
