import { View, Text } from '@tarojs/components';
import { useTheme } from '../../hooks/useTheme';
import './index.scss';

export default function PrivacyPolicyPage() {
  const themeStyle = useTheme();

  return (
    <View className="agreement-page" style={themeStyle}>
      <View className="agreement-content">
        <Text className="agreement-title">隐私政策</Text>
        
        <Text className="agreement-update">更新日期：2026年6月1日</Text>
        <Text className="agreement-update">生效日期：2026年6月1日</Text>

        <Text className="section-title">一、引言</Text>
        <Text className="section-content">
          "场景外语"小程序（以下简称"我们"）非常重视用户的隐私和个人信息保护。本隐私政策将向您说明我们如何收集、使用、存储和保护您的个人信息，以及您享有的相关权利。
        </Text>
        <Text className="section-content">
          请您在使用本服务前仔细阅读本隐私政策。如果您不同意本政策的任何内容，请您立即停止使用我们的服务。
        </Text>

        <Text className="section-title">二、我们收集的信息</Text>
        <Text className="section-content">
          2.1 账号信息{'\n'}
          当您使用登录功能时，我们会收集您的邮箱地址，用于账号注册、登录验证和找回密码。
        </Text>
        <Text className="section-content">
          2.2 学习数据{'\n'}
          当您登录后，我们会收集和存储您的学习记录，包括：已学习单词、收藏单词、学习进度、复习记录等，以便为您同步和恢复学习数据。
        </Text>
        <Text className="section-content">
          2.3 设置偏好{'\n'}
          我们会存储您的应用设置，包括：目标语言、主题设置等，以提供个性化的使用体验。
        </Text>
        <Text className="section-content">
          2.4 设备信息{'\n'}
          为了保障服务安全和优化用户体验，我们可能收集设备型号、操作系统版本、小程序版本等基本信息。
        </Text>

        <Text className="section-title">三、信息的使用目的</Text>
        <Text className="section-content">
          我们收集和使用您的个人信息仅用于以下目的：
        </Text>
        <Text className="section-content">
          （1）提供、维护和改进我们的服务；{'\n'}
          （2）创建和管理您的账号；{'\n'}
          （3）同步和恢复您的学习数据；{'\n'}
          （4）向您发送服务相关通知；{'\n'}
          （5）保障服务安全，防止欺诈行为；{'\n'}
          （6）遵守法律法规要求。
        </Text>

        <Text className="section-title">四、信息的存储</Text>
        <Text className="section-content">
          4.1 您的个人信息存储在位于中华人民共和国境内的服务器上。
        </Text>
        <Text className="section-content">
          4.2 我们采用业界标准的安全措施保护您的个人信息，包括但不限于数据加密、访问控制、安全审计等。
        </Text>
        <Text className="section-content">
          4.3 我们仅在实现目的所需的期限内保留您的个人信息，超出期限后将进行删除或匿名化处理。
        </Text>

        <Text className="section-title">五、信息的共享</Text>
        <Text className="section-content">
          5.1 我们不会向第三方出售您的个人信息。
        </Text>
        <Text className="section-content">
          5.2 我们仅在以下情况下可能共享您的信息：
        </Text>
        <Text className="section-content">
          （1）获得您的明确同意；{'\n'}
          （2）根据法律法规要求或政府主管部门的强制性要求；{'\n'}
          （3）为维护我们或其他用户的合法权益。
        </Text>

        <Text className="section-title">六、您的权利</Text>
        <Text className="section-content">
          6.1 访问权：您有权访问我们持有的关于您的个人信息。
        </Text>
        <Text className="section-content">
          6.2 更正权：您有权要求我们更正不准确或不完整的个人信息。
        </Text>
        <Text className="section-content">
          6.3 删除权：您有权要求我们删除您的个人信息。您可以通过注销账号来行使此权利。
        </Text>
        <Text className="section-content">
          6.4 撤回同意权：您有权随时撤回之前给予我们的同意。
        </Text>

        <Text className="section-title">七、未成年人保护</Text>
        <Text className="section-content">
          我们非常重视未成年人的个人信息保护。如果您是未成年人，请在监护人的陪同下阅读本政策，并在取得监护人同意后使用我们的服务。
        </Text>

        <Text className="section-title">八、隐私政策的更新</Text>
        <Text className="section-content">
          我们可能会适时修订本隐私政策。修订后的政策将在小程序内公布，请您定期查阅。如果您继续使用我们的服务，即表示您同意接受修订后的政策。
        </Text>

        <Text className="section-title">九、联系我们</Text>
        <Text className="section-content">
          如果您对本隐私政策有任何疑问、意见或建议，可通过小程序内的反馈功能联系我们。我们将在15个工作日内回复您的请求。
        </Text>
      </View>
    </View>
  );
}
