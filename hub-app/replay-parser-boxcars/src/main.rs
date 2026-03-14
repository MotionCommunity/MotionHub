// Motion Hub: Rocket League replay parser using boxcars.
// Outputs full replay JSON (header + network data) for more stats (goals, demolitions, frames, etc.).

use std::env;
use std::fs;
use std::io::{self, Write};

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: motion_replay_parse <replay.replay> [--header-only]");
        std::process::exit(1);
    }
    let path = &args[1];
    let header_only = args.iter().any(|a| a == "--header-only");

    let data = match fs::read(path) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("Error reading file: {}", e);
            std::process::exit(2);
        }
    };

    let replay: boxcars::Replay = match if header_only {
        boxcars::ParserBuilder::new(&data).parse()
    } else {
        boxcars::ParserBuilder::new(&data)
            .must_parse_network_data()
            .parse()
    } {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Parse error: {}", e);
            std::process::exit(3);
        }
    };

    let json: String = serde_json::to_string(&replay).expect("serialize");
    io::stdout().write_all(json.as_bytes()).expect("write stdout");
}
