import { wrap } from "../src/implementations/wrap";
import { Output } from "../src/implementations/utils/disk";
import { performance } from "perf_hooks";
import { existsSync, mkdirSync, rmdirSync, promises, constants } from "fs";
import { access } from "fs/promises";
import { SchemaId } from "@tradetrust-tt/tradetrust";
import { join, parse, resolve } from "path";

const DEFAULT_NUMBER_OF_FILE = 2;
const DEFAULT_ITERATION = 1;
const DEFAULT_FILE_PATH = join(__dirname, "unwrapped_document.json");
const INPUT_UNWRAPPED_FILE_FOLDER = join(__dirname, "setup", "raw-documents");
const OUTPUT_WRAPPED_FILE_FOLDER = join(__dirname, "setup", "wrapped-documents");

// Setup number of files
const setup = async (filePath: string, numberOfFiles: number): Promise<void> => {
  console.info("Setup up files for testing");
  const fileName = parse(filePath).name;
  const fileExtension = parse(filePath).ext;

  try {
    existsSync(INPUT_UNWRAPPED_FILE_FOLDER) || mkdirSync(INPUT_UNWRAPPED_FILE_FOLDER, { recursive: true });
    for (let index = 0; index < numberOfFiles; index++) {
      const outputPath = resolve(INPUT_UNWRAPPED_FILE_FOLDER, `${fileName + (index + 1)}${fileExtension}`);

      // Sanitize the file path to prevent directory traversal
      if (!outputPath.startsWith(INPUT_UNWRAPPED_FILE_FOLDER)) {
        throw new Error("Unsafe file path detected.");
      }

      // Ensure the file exists and is readable
      await access(filePath, constants.R_OK);

      // Copy the file safely
      await promises.copyFile(filePath, outputPath);
    }
  } catch (e) {
    console.error(e);
  }
};

// Destroy generated folder
const destroy = (): void => {
  console.info("Cleaning generated files from setup");
  !existsSync(INPUT_UNWRAPPED_FILE_FOLDER) || rmdirSync(INPUT_UNWRAPPED_FILE_FOLDER, { recursive: true });
  !existsSync(OUTPUT_WRAPPED_FILE_FOLDER) || rmdirSync(OUTPUT_WRAPPED_FILE_FOLDER, { recursive: true });
};

// Monitor batched wrap feature for the response time
const monitorWrapFeature = async (): Promise<void> => {
  try {
    // Retrieve User Input
    const numberOfFiles: number = parseInt(process.argv[2], 10) || DEFAULT_NUMBER_OF_FILE;
    const iteration: number = parseInt(process.argv[3], 10) || DEFAULT_ITERATION;
    const filePath: string = process.argv[4] || DEFAULT_FILE_PATH;

    // Ensure the provided file path is absolute
    const absoluteFilePath = resolve(filePath);

    // Ensure the file path is within the allowed directory
    if (!absoluteFilePath.startsWith(__dirname)) {
      throw new Error("Unsafe file path detected.");
    }

    // Setup Number of Files
    await setup(filePath, numberOfFiles);

    const responseTime: Array<number> = [];
    for (let index = 0; index < iteration; index++) {
      // Start monitoring
      console.info(`Iteration ${index + 1} : Start monitoring`);
      const startTime = performance.now();

      // Call OA CLI wrap
      console.info(`Iteration ${index + 1} : Wrapping Documents`);
      await wrap({
        inputPath: INPUT_UNWRAPPED_FILE_FOLDER,
        outputPath: OUTPUT_WRAPPED_FILE_FOLDER,
        version: SchemaId.v2,
        unwrap: false,
        outputPathType: Output.Directory,
        batched: true,
      });

      // Stop monitoring
      console.info(`Iteration ${index + 1} : Stop monitoring`);
      const endTime = performance.now();
      responseTime.push(endTime - startTime);
    }

    // Destroy Generated Files
    destroy();

    // Print time to execute
    console.info(`-----Summary-----`);
    const sumResponseTime: number = responseTime.reduce((a: number, b: number) => a + b, 0);
    const avgResponseTime: number = sumResponseTime / responseTime.length || 0;
    if (iteration > 1) {
      const fastestTime = Math.min(...responseTime);
      const slowestTime = Math.max(...responseTime);
      console.info(`Fastest Response Time : ${fastestTime} ms. (${fastestTime / 1000} s)`);
      console.info(`Slowest Response Time : ${slowestTime} ms. (${slowestTime / 1000} s)`);
      console.info(`Average Response Time : ${avgResponseTime} ms. (${avgResponseTime / 1000} s)`);
    } else {
      console.info(`OA Wrap took ${avgResponseTime} ms. (${avgResponseTime / 1000} s)`);
    }
  } catch (e) {
    // Destroy Generated Files
    destroy();
    console.error((e as Error).message);
  }
};

// eslint-disable-next-line jest/require-hook
monitorWrapFeature();
