import { Composition } from "remotion";
import { NoGasDemo } from "./Composition";
import { TOTAL_FRAMES } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition id="NoGasDemo" component={NoGasDemo} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
  );
};
