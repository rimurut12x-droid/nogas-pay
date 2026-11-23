import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, Series, staticFile, useVideoConfig } from "remotion";
import { Business, Circuit, Close, Detour, FillUp, Hook, Intro, Proof, SendFlow } from "./Scenes";
import { scenes, VO_DELAY } from "./theme";
import { Captions, Stage } from "./ui";

const views = [Hook, Detour, Intro, SendFlow, Proof, FillUp, Circuit, Business, Close];

export const NoGasDemo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Stage>
      <Audio src={staticFile("music.mp3")} volume={(f) => Math.min(1, f / (2 * fps), (durationInFrames - f) / (3 * fps)) * 0.16} />
      <Series>
        {scenes.map((s, i) => {
          const View = views[i];
          return (
            <Series.Sequence key={s.vo} durationInFrames={Math.round(s.sec * fps)} name={`Scene ${i + 1}`}>
              <View />
              <Sequence from={Math.round(VO_DELAY * fps)} name="Voiceover">
                <Audio src={staticFile(s.vo)} />
              </Sequence>
              <Captions text={s.text} voSec={s.voSec} />
            </Series.Sequence>
          );
        })}
      </Series>
    </Stage>
  );
};
