// TODO: This script is a work in progress and is not yet functional. It is intended to be used as a standalone script to compile the USWDS+ CSS. The script will prompt the user for the output file name, output path, and asset file path, and then compile the CSS using the specified options.

//ROADMAP:
// [ ] Import array of components from a JSON file (gold star if that JSON is generated by a script that reads the contents of the components directory)
// [ ] Split out asset file path variable update into icons, images, and fonts
// [X] Add option to update prefix for CSS variables (e.g. --aem, rather than --usa)
// [ ] Add "container-query" polyfill to postCSS plugins




const fs = require('fs');
const path = require('path');
const sass = require('sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const postcssPresetEnv = require('postcss-preset-env');

const defaultOptions = {
    outputFile: 'uswds+.min.css',
    outputPath: 'output/uswds+',
    postCSS: {
        autoprefix: true,
        minify: true,
        postcssPresetEnv: {
            stage: 3,
            features: {
                'custom-properties': true,
            },
        },
    },
    // Change SCSS variables in the main Sass file, "modify" is a boolean that determines whether the variable should be checked for quotes and slashes (like a file path)
    sassVariables: {
        assetFilePath: {value: '/assets/', modify: true},
        cssVarPrefix: {value: 'usa', modify: false},
    },
};

function loadOptions(configFile) {
    if (!configFile) {
        return {};
    }

    try {
        const configContent = fs.readFileSync(configFile, 'utf8');
        return JSON.parse(configContent);
    } catch (error) {
        console.error(`Error loading configuration file: ${configFile}`);
        return {};
    }
}

function checkForTrailingSlash(path) {
    let updatedPath = path.trim();

    if (!updatedPath.endsWith("/")) {
      updatedPath = `${updatedPath}/`;
    }
    
    return updatedPath;
  }

function ensureCSSExtension(filename) {
    if (filename.endsWith('.css')) {
        return filename;
    }
    return `${filename}.css`;
}


async function compileSass(options) {
    const { inputFiles, outputFile, outputPath, postCSS } = {
      ...defaultOptions,
      ...options,
    };
  
    // Read the contents of the main Sass file
    const sassCode = fs.readFileSync(inputFiles[0], 'utf8');
  
    // Replace the $assetFilePath variable in the Sass code
    let modifiedSassCode = sassCode;
    for (const key in options.sassVariables) {
  
        if (options.sassVariables.hasOwnProperty(key)) {
            const variable = options.sassVariables[key];
            const regex = new RegExp(`\\$${key}:\\s*[^;]+;`, 'g');
            if (variable.modify) {
                modifiedSassCode = modifiedSassCode.replace(
                    regex,
                    `$${key}: '${checkForTrailingSlash(variable.value)}';`
                );
            } else {
                modifiedSassCode = modifiedSassCode.replace(
                    regex,
                    `$${key}: ${variable.value};`
                );
            }
        }
    }
  
    // Get the directory of the main Sass file
    const mainSassDir = path.dirname(inputFiles[0]);
  
    const sassResult = sass.renderSync({
      data: modifiedSassCode,
      includePaths: [mainSassDir, ...inputFiles.slice(1)],
    });
  
    const cssCode = sassResult.css.toString();
  
    const postcssPlugins = [
      postcssPresetEnv(postCSS.postcssPresetEnv),
      postCSS.autoprefix && autoprefixer(),
      postCSS.minify && cssnano({ preset: 'default' }),
    ].filter(Boolean);
  
    const ora = await import('ora');
    const spinner = ora.default('Compiling SCSS...').start();
  
    postcss(postcssPlugins)
      .process(cssCode, { from: undefined })
      .then((result) => {
        spinner.succeed('SCSS compilation completed');
        const outputFilePath = path.join(outputPath, outputFile);
        fs.writeFileSync(outputFilePath, result.css);
        console.log(`\x1b[32mCSS file generated: ${outputFilePath}\x1b[0m`);
      })
      .catch((error) => {
        spinner.fail('SCSS compilation failed');
        console.error(error);
      });
  }


  async function promptUser() {
    console.log('\x1b[34m=== USWDS+ CSS Compilation ===\x1b[0m');
  
    const inquirer = await import('inquirer');
  
    const questions = [
      {
        type: 'input',
        name: 'outputFile',
        message: `Enter the output file name (default: ${defaultOptions.outputFile}):`,
        default: defaultOptions.outputFile,
      },
      {
        type: 'input',
        name: 'outputPath',
        message: `Enter the output path (default: ${defaultOptions.outputPath}):`,
        default: defaultOptions.outputPath,
      },
      {
        type: 'input',
        name: 'assetFilePath',
        message: `Enter the asset file path (default: ${defaultOptions.sassVariables.assetFilePath.value}):`,
        default: defaultOptions.sassVariables.assetFilePath.value,
      },
      {
        type: 'input',
        name: 'cssVarPrefix',
        message: `Enter the CSS variable prefix (default: ${defaultOptions.sassVariables.cssVarPrefix.value}):`,
        default: defaultOptions.sassVariables.cssVarPrefix.value,
      },
      {
        type: 'checkbox',
        name: 'components',
        message: 'Select the components to include:',
        choices: [
          { name: 'All', value: 'src/styles.scss' },
          { name: 'Component 2', value: 'path/to/component2.scss' },
          { name: 'Component 3', value: 'path/to/component3.scss' },
          // Add more components as needed
        ],
      },
    ];

    const alwaysIncludeFiles = [
        'src/styles.scss',
      ];
  
    const answers = await inquirer.default.prompt(questions);
    const options = {
        // deliberately generating a blank options file here (need to think through for the future how best to juggle being able to use this same script via the CLI and via the import statement in the other script)
    ...loadOptions(),
    outputFile: ensureCSSExtension(answers.outputFile),
    outputPath: answers.outputPath,
    sassVariables: {
      assetFilePath: { value: answers.assetFilePath, modify: true },
      cssVarPrefix: { value: answers.cssVarPrefix, modify: false },
    },
    inputFiles: [...alwaysIncludeFiles, ...answers.components],
    };
  
    compileSass(options);
  }

promptUser();