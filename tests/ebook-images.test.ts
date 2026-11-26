import { describe, expect, it } from "bun:test";
import { imagePaths, imageToken, textToXhtml } from "../src/lib/ebook";
import { ebookFiles } from "../src/lib/ebook-epub";

describe("e-book images", () => {
  it("renders an image token as a captioned figure", () => {
    const html = textToXhtml(`Texto\n\n${imageToken("u/s/a.jpg", "Ciclo")}`);
    expect(html).toContain('<figure><img src="ebook-img:u/s/a.jpg" alt="Ciclo"/><figcaption>Ciclo</figcaption></figure>');
    expect(imagePaths(html)).toEqual(["u/s/a.jpg"]);
  });
  it("keeps image markup inside chapter files", () => {
    const files = ebookFiles({ title: "T", language: "pt-BR", chapters: [{ id: "c", number: "1", title: "C", html: "", exercises: [], sections: [{ id: "s", kind: "block", number: "1.1", title: "S", html: textToXhtml(imageToken("p.jpg", "x")), exercises: [] }] }] }, "id");
    expect(files["OEBPS/ch1.xhtml"]).toContain("ebook-img:p.jpg");
  });
});
