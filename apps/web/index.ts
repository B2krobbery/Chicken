import { generateText } from "ai";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
    const { text } = await generateText({
        model: "openai/gpt-5.5",
        prompt: "Invent a new holiday and describe its traditions.",
    });
    console.log(text);
}

main().catch(console.error);
