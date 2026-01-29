import "react-native";

declare module "react-native" {
  interface FlatListProps<ItemT> {
    className?: string;
    tw?: string;
  }

  interface ImagePropsBase {
    className?: string;
    tw?: string;
  }

  interface ViewProps {
    className?: string;
    tw?: string;
  }

  interface TextProps {
    className?: string;
    tw?: string;
  }

  interface SwitchProps {
    className?: string;
    tw?: string;
  }

  interface InputAccessoryViewProps {
    className?: string;
    tw?: string;
  }

  interface TouchableWithoutFeedbackProps {
    className?: string;
    tw?: string;
  }

  interface ScrollViewProps {
    className?: string;
    tw?: string;
  }

  interface TextInputProps {
    className?: string;
    tw?: string;
  }

  interface TouchableOpacityProps {
    className?: string;
    tw?: string;
  }

  interface PressableProps {
    className?: string;
    tw?: string;
  }
}

declare module "react-native-safe-area-context" {
  interface SafeAreaViewProps {
    className?: string;
    tw?: string;
  }
}

declare module "react-native-reanimated" {
  interface AnimateProps<T> {
    className?: string;
    tw?: string;
  }
}
