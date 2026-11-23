import { Composition, Still } from "remotion";
import { Logo } from "./Scenes";
import { NoGasDemo } from "./Composition";
import { TOTAL_FRAMES } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Still id="Logo" component={() => <Logo size={256} />} width={256} height={256} />
    <Composition id="NoGasDemo" component={NoGasDemo} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
    </>
  );
};
